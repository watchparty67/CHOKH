/* ============================================================
   Watch Party — subtitles helper
   Exposes a single global: window.WPSubs
   - srtToVtt():  convert SRT text to WebVTT text (in-browser)
   - vttFromText(): normalise raw VTT/SUB text
   - loadInto():  build a <track> Blob URL on a <video>
   - toggle():    show / hide the active track
   ============================================================ */
(function () {
  "use strict";

  var WPSubs = {};

  /* ---- SRT timestamp "00:00:01,000" -> WebVTT "00:00:01.000" ---- */
  function fixTs(ts) {
    return String(ts).trim().replace(",", ".");
  }

  /* ---- Convert SRT text -> WebVTT text ----
     Handles:
       1                              (index — dropped)
       00:00:01,000 --> 00:00:04,000  (-> comma becomes dot)
       Hello world                    (text)
  */
  WPSubs.srtToVtt = function (srt) {
    if (!srt) return "WEBVTT\n\n";
    var text = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    var out = ["WEBVTT", ""];
    var blocks = text.split(/\n{2,}/);          // blocks separated by blank line
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].trim();
      if (!b) continue;

      var lines = b.split("\n");
      // Drop a leading numeric cue index (e.g. "1")
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      if (!lines.length) continue;

      // The first remaining line must be a cue time range
      var timeLine = lines[0];
      var m = timeLine.match(
        /(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{1,2}:\d{2}[.,]\d{3}|\d{1,2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{1,2}:\d{2}[.,]\d{3}|\d{1,2}[.,]\d{3})/
      );
      if (!m) continue;                          // skip malformed blocks

      var start = fixTs(m[1]);
      var end = fixTs(m[2]);
      var body = lines.slice(1).join("\n").trim();
      out.push(start + " --> " + end);
      out.push(body);
      out.push("");
    }
    return out.join("\n");
  };

  /* ---- Normalise a file that might already be VTT ----
     If it starts with WEBVTT we just clean it; otherwise treat as SRT. */
  WPSubs.vttFromText = function (raw, name) {
    var t = (raw || "").replace(/^\uFEFF/, "").trim();   // strip BOM
    if (/^WEBVTT/i.test(t)) return t;
    // .sub or unknown -> assume SRT structure
    return WPSubs.srtToVtt(t);
  };

  /* ---- Attach subtitles to a <video> as a <track> ----
     opts: { label, srclang }
     Returns the created/reused <track> element. */
  WPSubs.loadInto = function (video, vttText, opts) {
    opts = opts || {};
    // remove any existing WP track
    var tracks = video.querySelectorAll("track[data-wp]");
    for (var i = 0; i < tracks.length; i++) tracks[i].remove();

    var blob = new Blob([vttText], { type: "text/vtt" });
    var url = URL.createObjectURL(blob);

    var track = document.createElement("track");
    track.kind = "subtitles";
    track.label = opts.label || "Subtitles";
    track.srclang = opts.srclang || "en";
    track.src = url;
    track.default = true;
    track.setAttribute("data-wp", "1");
    video.appendChild(track);

    // default -> showing once it loads
    track.addEventListener("load", function () {
      if (track.track) track.track.mode = "showing";
    });
    return track;
  };

  /* ---- Toggle subtitles on/off ----
     state omitted = flip current; true/false = force.
     Returns the new visible state (boolean). */
  WPSubs.toggle = function (video, state) {
    var track = video.querySelector("track[data-wp]");
    if (!track || !track.track) return false;
    var on = (typeof state === "boolean") ? state : (track.track.mode !== "showing");
    track.track.mode = on ? "showing" : "hidden";
    return on;
  };

  WPSubs.hasSubs = function (video) {
    return !!video.querySelector("track[data-wp]");
  };

  /* ---- Read a File (.srt/.vtt/.sub) and return {vtt, name} ---- */
  WPSubs.read = function (file, cb) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var vtt = WPSubs.vttFromText(ev.target.result, file.name);
        cb(null, { vtt: vtt, name: file.name });
      } catch (e) {
        cb(e);
      }
    };
    reader.onerror = function () { cb(new Error("read error")); };
    reader.readAsText(file);
  };

  window.WPSubs = WPSubs;
})();
