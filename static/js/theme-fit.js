(function () {
  var text = document.querySelector(".intro-text");
  var img = document.querySelector(".theme img");
  if (!text || !img) return;

  var stacked = window.matchMedia("(max-width: 640px)");

  function fit() {
    if (stacked.matches) { img.style.height = ""; return; }
    var h = text.getBoundingClientRect().bottom - img.getBoundingClientRect().top;
    img.style.height = Math.max(0, h) + "px";
  }

  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(text);
  else window.addEventListener("resize", fit);
  stacked.addEventListener("change", fit);
  window.addEventListener("load", fit); 
})();
