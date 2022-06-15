var WebSocket = require("ws");
require("dotenv").config();
const db = require("better-sqlite3")("data.db");
const ssid = process.env.SSID;
var Scratch = {};
const CLOUDSERVER = "clouddata.scratch.mit.edu";
const PROJECT = 664911386;

// TODO: Make code more optimized + add more comments

Scratch.CloudSession = { ws: undefined };

const decode = (i) => {
  let chars = "1234567890qwertyuiopasdfghjklzxcvbnm-_";
  let a = i.match(/.{1,2}/g);
  let res = "";
  for (index in a) {
    res += chars.substring(a[index] - 1, a[index]);
  }
  return res;
};

Scratch.CloudSession._set = (method, value, name) => {
  setTimeout(() => {
    Scratch.CloudSession.ws.send(
      JSON.stringify({
        method: method,
        name: name,
        project_id: PROJECT.toString(),
        user: "RainbowFrogl",
        value: value,
      }) + "\n"
    );
  }, 1000);
};

const _set = (bool, d) => {
  console.log(`Attempting to add new user. BOOL ${bool * 1} ANSWER ${d}`);
  db.prepare("INSERT INTO data (name, ans) VALUES (?,?)").run(
    d,
    (bool * 1).toString()
  );
};

Scratch.CloudSession.create = () => {
  Scratch.CloudSession.ws = new WebSocket(`wss://${CLOUDSERVER}`, [], {
    headers: {
      cookie: `scratchsessionsid=${ssid}`,
      origin: `https://scratch.mit.edu`,
    },
  });

  let ws = Scratch.CloudSession.ws;
  ws.on("message", (data) => {
    var dped = JSON.parse(data.toString().split("\n")[0]);
    if (
      dped.method == "set" &&
      dped.value != "200" &&
      dped.name == "☁ TOHOST"
    ) {
      switch (dped.value.substring(0, 4)) {
        case "1230":
          let d = db
            .prepare("SELECT * FROM data WHERE name = ?")
            .get(decode(dped.value.slice(4)));
          Scratch.CloudSession._set(
            "set",
            d == undefined ? "1" : `0${d.ans}`,
            "☁ FROMHOST"
          );
          break;
        case "3210":
          _set(false, decode(dped.value.slice(4)));
          break;
        case "3211":
          _set(true, decode(dped.value.slice(4)));
          break;
      }
    }
  });
  ws.on("open", () => {
    console.log("Connected");
    // Handshake
    ws.send(
      JSON.stringify({
        method: "handshake",
        user: "RainbowFrogl",
        project_id: "664911386",
      }) + "\n"
    );
    Scratch.CloudSession._set("set", "200", "☁ TOHOST");
  });
};

db.exec("CREATE TABLE IF NOT EXISTS data (name TEXT, ans TEXT)");

Scratch.CloudSession.create();

Scratch.CloudSession.ws.on("close", () => {
  Scratch.CloudSession.create();
});
