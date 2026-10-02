/**
 * FrameSnap — Video to Image Converter
 * Client-side JavaScript for upload, configuration, and interaction.
 */

(function () {
  "use strict";

  // === DOM Elements ===
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const fileInfo = document.getElementById("file-info");
  const fileName = document.getElementById("file-name");
  const fileSize = document.getElementById("file-size");
  const videoPreview = document.getElementById("video-preview");
  const btnRemove = document.getElementById("btn-remove");
  const optionsPanel = document.getElementById("options-panel");
  const actionRow = document.getElementById("action-row");
  const btnExtract = document.getElementById("btn-extract");
  const progressCard = document.getElementById("progress-card");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const progressSub = document.getElementById("progress-sub");
  const resultsCard = document.getElementById("results-card");
  const resultsSubtitle = document.getElementById("results-subtitle");
  const gallery = document.getElementById("gallery");
  const btnDownload = document.getElementById("btn-download");
  const btnNew = document.getElementById("btn-new");

  // Mode toggle
  const modeToggle = document.getElementById("mode-toggle");
  const intervalGroup = document.getElementById("interval-group");
  const intervalInput = document.getElementById("interval-input");
  const intervalDec = document.getElementById("interval-dec");
  const intervalInc = document.getElementById("interval-inc");

  // Format toggle
  const formatToggle = document.getElementById("format-toggle");
  const qualityGroup = document.getElementById("quality-group");
  const qualitySlider = document.getElementById("quality-slider");
  const qualityValue = document.getElementById("quality-value");

  // Stats
  const statFrames = document.getElementById("stat-frames");
  const statFormat = document.getElementById("stat-format");
  const statDuration = document.getElementById("stat-duration");
  const statZip = document.getElementById("stat-zip");

  // === State ===
  let selectedFile = null;
  let currentJobId = null;
  let currentMode = "all";
  let currentFormat = "jpg";

  // === Drag & Drop ===
  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("video/")) {
      handleFileSelect(files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      handleFileSelect(fileInput.files[0]);
    }
  });

  // === File Selection ===
  function handleFileSelect(file) {
    selectedFile = file;

    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);

    // Video thumbnail
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    videoPreview.currentTime = 1;

    // Toggle visibility
    dropzone.classList.add("hidden");
    fileInfo.classList.remove("hidden");
    optionsPanel.classList.remove("hidden");
    actionRow.classList.remove("hidden");
    progressCard.classList.add("hidden");
    resultsCard.classList.add("hidden");
  }

  // === Remove File ===
  btnRemove.addEventListener("click", () => {
    resetUpload();
  });

  function resetUpload() {
    selectedFile = null;
    currentJobId = null;
    fileInput.value = "";
    videoPreview.src = "";

    dropzone.classList.remove("hidden");
    fileInfo.classList.add("hidden");
    optionsPanel.classList.add("hidden");
    actionRow.classList.add("hidden");
    progressCard.classList.add("hidden");
    resultsCard.classList.add("hidden");
  }

  // === Mode Toggle ===
  modeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    modeToggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.value;

    if (currentMode === "interval") {
      intervalGroup.classList.remove("hidden");
    } else {
      intervalGroup.classList.add("hidden");
    }
  });

  // === Interval Stepper ===
  intervalDec.addEventListener("click", () => {
    let val = parseFloat(intervalInput.value) - 0.5;
    if (val < 0.1) val = 0.1;
    intervalInput.value = val.toFixed(1);
  });

  intervalInc.addEventListener("click", () => {
    let val = parseFloat(intervalInput.value) + 0.5;
    if (val > 60) val = 60;
    intervalInput.value = val.toFixed(1);
  });

  // === Format Toggle ===
  formatToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    formatToggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFormat = btn.dataset.value;

    if (currentFormat === "jpg") {
      qualityGroup.classList.remove("hidden");
    } else {
      qualityGroup.classList.add("hidden");
    }
  });

  // === Quality Slider ===
  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = qualitySlider.value;
  });

  // === Extract Frames ===
  btnExtract.addEventListener("click", () => {
    if (!selectedFile) return;
    startExtraction();
  });

  async function startExtraction() {
    // Show progress
    actionRow.classList.add("hidden");
    progressCard.classList.remove("hidden");
    resultsCard.classList.add("hidden");
    progressBar.style.width = "0%";
    progressText.textContent = "Uploading video...";
    progressSub.textContent = "Please wait while we process your video";
    btnExtract.disabled = true;

    const formData = new FormData();
    formData.append("video", selectedFile);
    formData.append("mode", currentMode);
    formData.append("interval", intervalInput.value);
    formData.append("format", currentFormat);
    formData.append("quality", qualitySlider.value);

    // Simulate upload progress
    animateProgress(0, 60, 2000);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      animateProgress(60, 90, 500);

      let data = {};
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        } else {
          throw new Error("Empty response");
        }
      } catch (parseError) {
        throw new Error("Server returned an invalid response (might be too large). Status: " + response.status);
      }

      if (!response.ok) {
        throw new Error(data.error || "Extraction failed (Status: " + response.status + ")");
      }

      animateProgress(90, 100, 300);

      setTimeout(() => {
        showResults(data);
      }, 400);
    } catch (err) {
      progressText.textContent = "❌ " + err.message;
      progressSub.textContent = "Please try again with a different file";
      progressBar.style.width = "100%";
      progressBar.style.background = "var(--accent-2)";

      setTimeout(() => {
        progressCard.classList.add("hidden");
        actionRow.classList.remove("hidden");
        btnExtract.disabled = false;
        progressBar.style.background = "";
      }, 3000);
    }
  }

  function animateProgress(from, to, duration) {
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const val = from + (to - from) * easeOut(t);
      progressBar.style.width = val + "%";
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // === Show Results ===
  function showResults(data) {
    currentJobId = data.job_id;

    progressCard.classList.add("hidden");
    resultsCard.classList.remove("hidden");

    resultsSubtitle.textContent = `Successfully extracted from your video`;

    statFrames.textContent = data.frame_count.toLocaleString();
    statFormat.textContent = data.format.toUpperCase();
    statDuration.textContent = formatDuration(data.duration);
    statZip.textContent = formatBytes(data.zip_size);

    btnDownload.href = `/api/download/${data.job_id}`;

    // Preview gallery (show up to 12 frames, evenly spaced)
    gallery.innerHTML = "";
    const maxPreview = Math.min(12, data.frame_count);
    const step = Math.max(1, Math.floor(data.frame_count / maxPreview));

    for (let i = 0; i < maxPreview; i++) {
      const frameIdx = i * step;
      const item = document.createElement("div");
      item.className = "gallery-item";
      const img = document.createElement("img");
      img.src = `/api/preview/${data.job_id}/${frameIdx}`;
      img.alt = `Frame ${frameIdx}`;
      img.loading = "lazy";
      item.appendChild(img);

      item.addEventListener("click", () => {
        openLightbox(img.src);
      });

      gallery.appendChild(item);
    }

    btnExtract.disabled = false;
  }

  // === Lightbox ===
  function openLightbox(src) {
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";

    const closeBtn = document.createElement("button");
    closeBtn.className = "lightbox-close";
    closeBtn.textContent = "✕";

    const img = document.createElement("img");
    img.src = src;

    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target === closeBtn) close();
    });

    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", handler);
      }
    });
  }

  // === Convert Another ===
  btnNew.addEventListener("click", () => {
    // Cleanup old job
    if (currentJobId) {
      fetch(`/api/cleanup/${currentJobId}`, { method: "DELETE" }).catch(() => {});
    }
    resetUpload();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // === Helpers ===
  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDuration(seconds) {
    if (seconds < 60) return seconds.toFixed(1) + "s";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
})();
