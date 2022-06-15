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
  // Decode username to human readable text

  let chars = "1234567890qwertyuiopasdfghjklzxcvbnm-_";

  // Use regex to gather split string into groups of two
  let a = i.match(/.{1,2}/g);

  //
  let res = "";

  for (index in a) {
    res += chars.substring(a[index] - 1, a[index]);
  }

  return res;
};

Scratch.CloudSession._set = (method, value, name) => {
  // Send packet to change cloud data variable on server end

  Scratch.CloudSession.ws.send(
    JSON.stringify({
      method: method,
      name: name,
      project_id: PROJECT.toString(),
      user: "RainbowFrogl",
      value: value,
    }) + "\n"
  );
};

const _set = (bool, d) => {
  // Add user to database and their response (No reason to deal with malformed packet)

  console.log(`Attempting to add new user. BOOL ${bool * 1} ANSWER ${d}`);

  // Simple SQLite3 query to add user to database
  db.prepare("INSERT INTO data (name, ans) VALUES (?,?)").run(
    d,
    // Convert boolean to int
    (bool * 1).toString()
  );
};

Scratch.CloudSession.create = () => {
  // Create new websocket connection to cloud server
  Scratch.CloudSession.ws = new WebSocket(`wss://${CLOUDSERVER}`, [], {
    headers: {
      cookie: `scratchsessionsid=${ssid}`,
      origin: `https://scratch.mit.edu`,
    },
  });

  // Shorter variable for websocket
  let ws = Scratch.CloudSession.ws;

  // Handle received packets
  ws.on("message", (data) => {
    // Parse packet
    var dped = JSON.parse(data.toString().split("\n")[0]);

    // Check if the packet has not been read and was sent from client.
    if (
      dped.method == "set" &&
      dped.value != "200" &&
      dped.name == "☁ TOHOST"
    ) {
      // Switch statement for first 4 sequences in parsed data
      // The numbers are just to determine what the client wants to do with them
      switch (dped.value.substring(0, 4)) {
        case "1230":
          // Get data from database if user exists
          let d = db
            .prepare("SELECT * FROM data WHERE name = ?")
            .get(decode(dped.value.slice(4)));

          // Upload send data to client
          Scratch.CloudSession._set(
            "set",
            // Ternary operator to construct client readable response
            // If data is not found, return 1 (indicating user does not exist and must prompt for answer)
            d == undefined ? "1" : `0${d.ans}`,
            "☁ FROMHOST"
          );
          break;
        case "3210":
          // Handle answer false
          _set(false, decode(dped.value.slice(4)));
          break;
        case "3211":
          // Handle answer true
          _set(true, decode(dped.value.slice(4)));
          break;
      }
    }
  });
  ws.on("open", () => {
    console.log("Connected");

    // Handshake with server
    ws.send(
      JSON.stringify({
        method: "handshake",
        user: "RainbowFrogl",
        project_id: "664911386",
      }) + "\n"
    );

    // Clear all inbound data
    Scratch.CloudSession._set("set", "200", "☁ TOHOST");
  });
};

// Create SQLite3 table if it does not exist
db.exec("CREATE TABLE IF NOT EXISTS data (name TEXT, ans TEXT)");

// Create new cloud session
Scratch.CloudSession.create();

// Reconnect if cloudsession is lost
Scratch.CloudSession.ws.on("close", () => {
  Scratch.CloudSession.create();
});
