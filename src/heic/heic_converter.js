import { heicTo } from "heic-to";
import { userscriptSettings } from '../utils/settings';

function processAnchor(anchor) {
  if (!userscriptSettings.get("heicImageDecoding")) {
    return;
  }

  const href = anchor.getAttribute("href");
  const text = anchor.textContent.trim();

  if (!href || !text.toUpperCase().endsWith(".HEIC")) return;
  if (!href.toLowerCase().endsWith(".heic")) return;

  console.log("Trying to decode", href);

  GM_xmlhttpRequest({
    method: "GET",
    url: href,
    responseType: "arraybuffer",
    redirect: 'follow',
    onload: function (res) {
      const blob = new Blob([res.response], { type: "image/heic" });

      heicTo({ blob, type: "image/jpeg" })
        .then((result) => {
          const imgBlob = Array.isArray(result) ? result[0] : result;
          const url = URL.createObjectURL(imgBlob);

          const img = document.createElement("img");
          img.src = url;
          img.alt = text;

          anchor.replaceWith(img);
        })
        .catch((err) => {
          console.error("Failed to convert HEIC:", err);
        });
    },
    onerror: function (err) {
      console.error("Failed to fetch HEIC:", err);
    },
  });
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "A") {
          processAnchor(node);
        } else {
          node.querySelectorAll?.("a").forEach(processAnchor);
        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

document.querySelectorAll("a").forEach(processAnchor);