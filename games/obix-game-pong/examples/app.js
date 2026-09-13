import { mountPong } from "../dist/index.js";

const assetsBase = new URL("../assets/", import.meta.url);

mountPong(document.getElementById("game"), {
  config: { width: 800, height: 450, winningScore: 11 },
  assets: assetsBase,
});
