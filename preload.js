// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
  const storage = require("electron-json-storage");
  storage.get("data", function (err, object) {
    document.getElementById("username").value = object.username;
    document.getElementById("password").value = object.password;
  });

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ["chrome", "node", "electron"]) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
