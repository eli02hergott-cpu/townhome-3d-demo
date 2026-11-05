/* 360° tour: Unreal panoramas of one plan (assets/tour/<plan>/), one per room, with arrows between rooms.
   tour.json (written by the Unreal render tools): { plan, unit, start, nodes: [{ id, name, floor, look, links: [{ to, label, yaw, pitch }] }] }
   Angles are degrees; yaw 0 = facing the rear of the house, all panoramas share that orientation. */
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";

const $ = (s) => document.querySelector(s);
const rad = (d) => (d * Math.PI) / 180;
const plan = new URLSearchParams(location.search).get("plan") || "1435";
const base = `assets/tour/${plan}/`;
// Phones get the 4096-wide panoramas (smaller download, fits every phone's GPU); bigger screens the full 6144
const big = Math.max(screen.width, screen.height) * (devicePixelRatio || 1) > 1600 && !matchMedia("(hover: none)").matches;
const file = (id) => `${base}${id}${big ? "" : "-4k"}.jpg`;

// Sent as its own link: no page to close back to.
$("#tClose").remove();

const data = await fetch(`${base}tour.json`).then((r) => r.json());
$("#tPlan").textContent = `The ${data.plan}`;
$("#tNote").textContent = `${data.unit} · unfurnished · finishes shown may vary`;
const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));

const arrow = (link) => {
  const el = document.createElement("div");
  el.className = "t-link";
  el.innerHTML = `<span class="t-link-dot"></span><span class="t-link-label">${link.data.label}</span>`;
  return el;
};

const viewer = new Viewer({
  container: "viewer",
  navbar: false,
  loadingTxt: "",
  minFov: 35,
  maxFov: 100,
  defaultZoomLvl: 10,
  mousewheelCtrlKey: false,
  touchmoveTwoFingers: false,
  plugins: [
    MarkersPlugin,
    [VirtualTourPlugin, {
      positionMode: "manual",
      renderMode: "2d",
      startNodeId: data.start,
      preload: true,
      showLinkTooltip: false,
      arrowStyle: { element: arrow, size: { width: 140, height: 80 } },
      transitionOptions: { showLoader: true, effect: "fade", speed: "25rpm", rotation: true },
      nodes: data.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        panorama: file(n.id),
        thumbnail: `${base}${n.id}-thumb.jpg`,
        links: n.links.map((l) => ({ nodeId: l.to, position: { yaw: rad(l.yaw), pitch: rad(l.pitch) }, data: { label: l.label } })),
      })),
    }],
  ],
});
const tour = viewer.getPlugin(VirtualTourPlugin);

/* room strip, grouped by floor */
const rooms = $("#tRooms");
const LVL = { "-1": "Outside", 0: "Main floor", 1: "Upstairs" };
[-1, 0, 1].forEach((f) => {
  const list = data.nodes.filter((n) => n.floor === f);
  if (!list.length) return;
  if (rooms.children.length) rooms.insertAdjacentHTML("beforeend", `<span class="sep"></span>`);
  rooms.insertAdjacentHTML("beforeend", `<span class="lvl">${LVL[f]}</span>`);
  list.forEach((n) => rooms.insertAdjacentHTML("beforeend", `<button type="button" data-id="${n.id}">${n.name}</button>`));
});
rooms.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b || b.classList.contains("on")) return;
  const n = byId[b.dataset.id];
  tour.setCurrentNode(n.id, { rotation: false }).then(() => viewer.rotate({ yaw: rad(n.look), pitch: 0 }));
});

let first = true;
tour.addEventListener("node-changed", ({ node }) => {
  $("#tWhere").textContent = node.name;
  rooms.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", b.dataset.id === node.id);
    if (b.dataset.id === node.id) b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
  if (first) {
    first = false;
    viewer.rotate({ yaw: rad(byId[node.id].look), pitch: 0 });
    $("#tLoading").classList.add("hide");
  }
});

/* hide the help after the first look-around */
let helpTimer = setTimeout(() => $("#tHelp").classList.add("hide"), 9000);
viewer.addEventListener("position-updated", () => {
  clearTimeout(helpTimer);
  helpTimer = setTimeout(() => $("#tHelp").classList.add("hide"), 2500);
}, { once: true });
