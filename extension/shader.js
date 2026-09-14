// extension/shader.js
import { ShaderMount, getShaderColorFromString, meshGradientFragmentShader } from "./vendor/paper-shaders/dist/index.js";

const heroEl = document.getElementById("hero");
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const colorsHex = dark
  ? ["#121416", "#1B1E21", "#2E5C42", "#6FBF8E"]
  : ["#F5F6F3", "#D8DCD5", "#9FC7AD", "#1F5C3A"];
const colors = colorsHex.map(getShaderColorFromString);

let mount = null;
if (heroEl) {
  mount = new ShaderMount(heroEl, meshGradientFragmentShader, {
    u_colors: colors,
    u_colorsCount: 4,
    u_distortion: 0.7,
    u_swirl: 0.15,
    u_grainMixer: 0,
    u_grainOverlay: 0,
    u_scale: 1,
    u_rotation: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_fit: 0
  }, undefined, reducedMotion ? 0 : 0.25);
}

document.addEventListener("jobie:shader", (event) => {
  if (mount && event.detail) mount.setSpeed(event.detail.speed);
});

// shrink-on-scroll: the panel body is the only scroll container in the extension
const scroller = document.getElementById("panel");
if (scroller && heroEl) {
  scroller.addEventListener("scroll", () => {
    heroEl.classList.toggle("is-scrolled", scroller.scrollTop > 100);
  });
}
