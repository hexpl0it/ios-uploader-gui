// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
const api = require("ios-uploader");
const utility = require("ios-uploader/lib/utility");
var ProgressBar = require("progressbar.js");
var progress = document.getElementById("progress");
const Swal = require("sweetalert2");
const storage = require("electron-json-storage");

var line = new ProgressBar.Line("#progress", {
  strokeWidth: 4,
  easing: "easeInOut",
  duration: 1400,
  color: "#FFEA82",
  trailColor: "#eee",
  trailWidth: 1,
  svgStyle: { width: "100%", height: "100%" },
  text: {
    style: {
      // Text color.
      // Default: same as stroke color (options.color)
      textAlign: "center",
      color: "#999",
      right: "0",
      top: "30px",
      padding: 0,
      margin: 0,
      transform: null,
    },
    autoStyleContainer: false,
  },
  from: { color: "#FFEA82" },
  to: { color: "#ED6A5A" },
  step: (state, bar) => {
    bar.setText(Math.round(bar.value() * 100) + " %");
  },
});

function displaylog(message) {
  document.getElementById("log").innerText = message;
}

async function runUpload(ctx) {
  try {
    // Open the application file for reading.
    ctx.fileHandle = await utility.openFile(ctx.filePath);

    // Bundle ID and version lookup.
    try {
      let extracted = await utility.extractBundleIdAndVersion(ctx.fileHandle);
      ctx.bundleId = extracted.bundleId;
      ctx.bundleVersion = extracted.bundleVersion;
      ctx.bundleShortVersion = extracted.bundleShortVersion;
      displaylog(
        `Found Bundle ID "${ctx.bundleId}", Version ${ctx.bundleVersion} (${ctx.bundleShortVersion}).`
      );
    } catch (err) {
      line.animate(0);
      Swal.fire({
        icon: "error",
        title: "Caricamento fallito",
        text:
          "Failed to extract Bundle ID and version, are you supplying a valid IPA-file?",
      });
      displaylog("");
    }

    // Authenticate with Apple.
    await api.authenticateForSession(ctx);

    // Find "Apple ID" of application.
    await api.lookupSoftwareForBundleId(ctx);

    displaylog(`Identified application as "${ctx.appName}" (${ctx.appleId}).`);

    // Generate metadata.
    await api.generateMetadata(ctx);

    // Validate metadata and assets.
    await api.validateMetadata(ctx);
    await api.validateAssets(ctx);
    await api.clientChecksumCompleted(ctx);

    // Make reservations for uploading.
    let reservations = await api.createReservation(ctx);

    // For time calculations.
    ctx.transferStartTime = Date.now();

    var maxLenght = ctx.metadataSize + ctx.fileSize;

    let q = queue(api.executeOperation, ctx.concurrency);

    // Start uploading.
    for (let reservation of reservations) {
      let tasks = reservation.operations.map((operation) => ({
        ctx,
        reservation,
        operation,
      }));
      q.push(tasks, () => {
        ctx.speed = utility.formatSpeed(
          ctx.bytesSent,
          Date.now() - ctx.transferStartTime
        );
        line.animate(ctx.bytesSent / maxLenght);
      });
      await Promise.race([q.drain(), q.error()]);
      await api.commitReservation(ctx, reservation);
    }

    // Calculate transfer time.
    ctx.transferTime = ctx.transferStartTime - Date.now();

    // Finish
    await api.uploadDoneWithArguments(ctx);

    displaylog("The cookies are done.");
  } catch (err) {
    line.animate(0);
    Swal.fire({
      icon: "error",
      title: "Caricamento fallito",
      text: err.message,
    });
    displaylog("Pronto per il caricamento");
  } finally {
    if (ctx.fileHandle) {
      await utility.closeFile(ctx.fileHandle);
    }
  }
}

async function prepareForUpload() {
  var username = document.getElementById("username").value;
  var password = document.getElementById("password").value;
  var file = document.getElementById("fileInput").files[0].path;
  const ctx = {
    username: username,
    password: password,
    filePath: file,
    concurrency: 4,
    packageName: "app.itmsp",
    bytesSent: 0,
    speed: "N/A",
  };

  ctx.fileHandle = await utility.openFile(ctx.filePath);
  runUpload(ctx);
}

document.getElementById("btnClose").onclick = () => {
  storage.set(
    "data",
    {
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
    },
    function () {
      window.close();
    }
  );
};

document.getElementById("btnSfoglia").onclick = () => {
  var fileInput = document.getElementById("fileInput");
  fileInput.onchange = prepareForUpload;
  fileInput.click();
};
