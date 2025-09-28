import styleTweaks from './style_tweaks.scss';

console.log("Bootstrapped Piazza Revert");

GM_addStyle(styleTweaks);

function injectEndorsementFix() {
    const endorsementInfo = new Map();
    let lastKnownPathname = null;

    function populateEndorsementInfo(obj) {
        if (!obj || typeof obj !== 'object') return;

        const endorse = [obj.tag_good, obj.tag_endorse].find(Boolean);

        // If the object has an id and tag_good, store it in the Map
        if (obj.id && Array.isArray(endorse) && endorse.length > 0) {
            endorsementInfo.set(obj.id, endorse);
        }

        // Recurse into object properties
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const val = obj[key];
                if (Array.isArray(val)) {
                    val.forEach(item => populateEndorsementInfo(item));
                } else if (typeof val === 'object' && val !== null) {
                    populateEndorsementInfo(val);
                }
            }
        }
    }

    async function updateEndorsementInfo() {
        const url = window.location.pathname;

        const match = url.match(/\/class\/([^\/]+)\/post\/([^\/]+)/);

        endorsementInfo.clear();

        if (match) {
            const classId = match[1];
            const postId = match[2];
            const res = await fetch("https://piazza.com/logic/api?method=content.get", {
                "credentials": "include",
                "headers": {
                    "Accept": "application/json, text/plain, */*",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache",
                    "CSRF-Token": unsafeWindow.CSRF_TOKEN
                },
                "referrer": window.location.href,
                "body": JSON.stringify({
                    "method": "content.get",
                    "params": {
                        "cid": postId,
                        "nid": classId,
                        "student_view": null
                    }
                }),
                "method": "POST",
                "mode": "cors"
            });
            const val = await res.json();
            populateEndorsementInfo(val);
        }
        console.log(endorsementInfo);
    }

    function findIdFromArticle(article) {
        const targetDiv = article.querySelector('div[id$="_render"]');
        if (targetDiv != null) {
            return targetDiv.id.replace(/_render$/, '');
        } else {
            return "unknown";
        }
    }

    async function handleEndorsement(targetNode) {
        if (targetNode.classList.contains("endorsement-patched")) {
            return;
        }

        if (lastKnownPathname != window.location.pathname) {
            await updateEndorsementInfo();
            lastKnownPathname = window.location.pathname;
        }
        let commentId;
        const instructorAnswerArticle = targetNode.closest('article[aria-label="Instructor Answer"]');
        if (instructorAnswerArticle) {
            commentId = findIdFromArticle(instructorAnswerArticle);
        } else {
            const mainQuestionArticle = targetNode.closest('article[id="qaContentViewId"]');
            if (mainQuestionArticle != null) {
                commentId = findIdFromArticle(mainQuestionArticle);
            } else {
                const commentDiv = targetNode.closest('div[id]');
                if (commentDiv != null) {
                    commentId = commentDiv.id;
                }
            }
        }
        let info = endorsementInfo.get(commentId) ?? [];
        info = info.filter(obj => obj.admin).map(obj => obj.name);
        console.log('Found endorsement:', targetNode, "id:", commentId, "info:", info);
        if (info.length > 1) {
            // Swap content
            targetNode.classList.add("endorsement-patched");
            targetNode.textContent = "Endorsed by Instructors (" + info.join(', ') + ")";
        }
    }

    const observer = new MutationObserver(async(mutationsList) => {
        for (const mutation of mutationsList) {
            // Check any newly added nodes
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // element
                    // Case 1: The new node itself is the <b> inside .badge-success
                    if (node.matches('div.badge-success > b') && node.textContent.trim().startsWith("Endorsed by Instructor")) {
                        await handleEndorsement(node);
                    }

                    // Case 2: A container was added that *contains* the target <b>
                    const targetList = node.querySelectorAll?.('div.badge-success > b');
                    for (const target of targetList) {
                        if (target && target.textContent.trim().startsWith("Endorsed by Instructor")) {
                            await handleEndorsement(target);
                        }
                    }
                }
            }

            // Also check if an existing <b> just got text content added/changed
            if (mutation.type === "characterData") {
                const parent = mutation.target.parentElement;
                if (parent?.matches('div.badge-success > b') && parent.textContent.trim().startsWith("Endorsed by Instructor")) {
                    await handleEndorsement(parent);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,        // watch for added/removed elements
        subtree: true,          // include descendants
        characterData: true     // detect text/content changes
    });
}

function waitForElement(selector, callback) {
    const el = document.querySelector(selector);
    if (el) {
        callback(el);
        return;
    }

    const observer = new MutationObserver((mutations, obs) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.matches(selector)) {
                    obs.disconnect();
                    callback(node);
                    return;
                }
                // Also check descendants
                const found = node.querySelector(selector);
                if (found) {
                    obs.disconnect();
                    callback(found);
                    return;
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

class SettingsManager {
    constructor(storageKey = "piazzaRevertUserscriptSettings") {
        this.storageKey = storageKey;
        this.settings = {};
        this.load();
        this._fireInitialEvents();
    }

    // Define a new setting
    addSetting({ key, label, type = "boolean", defaultValue = false }) {
        if (!(key in this.settings)) {
            this.settings[key] = defaultValue;
        }
        // Store metadata
        if (!this._meta) this._meta = {};
        this._meta[key] = { label, type };
    }

    // Toggle boolean setting
    set(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        this.save();

        // Fire a custom event
        _fireEvent(key, oldValue, value);
    }

    get(key) {
        return this.settings[key];
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    }

    load() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.settings = JSON.parse(stored);
            } catch { }
        }
    }

    _fireEvent(key, oldValue, newValue) {
        const event = new CustomEvent("SettingsChanged", {
            detail: { key, oldValue, newValue }
        });
        window.dispatchEvent(event);
    }

    _fireInitialEvents() {
        for (const key in this.settings) {
            this._fireEvent(key, null, this.settings[key]);
        }
    }

    // Build settings popover
    showDialog() {
        const existing = document.getElementById("userscript-settings-dialog");
        if (existing) existing.remove();

        // Overlay
        const overlay = document.createElement("div");
        overlay.className = "us-settings-overlay";

        // Dialog
        const dialog = document.createElement("div");
        dialog.className = "us-settings-dialog";

        // Title
        const title = document.createElement("h2");
        title.textContent = "Settings";
        dialog.appendChild(title);

        // Build settings inputs
        for (const key in this._meta) {
            const meta = this._meta[key];
            const container = document.createElement("div");
            container.className = "setting-container";

            if (meta.type === "boolean") {
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = !!this.get(key);
                checkbox.addEventListener("change", e => this.set(key, e.target.checked));
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(meta.label));
                container.appendChild(label);
            } else if (meta.type === "number") {
                const label = document.createElement("label");
                label.style.flexDirection = "column";
                label.style.fontSize = "14px";
                label.textContent = meta.label;
                const input = document.createElement("input");
                input.type = "number";
                input.value = this.get(key);
                input.addEventListener("change", e => this.set(key, parseFloat(e.target.value)));
                label.appendChild(input);
                container.appendChild(label);
            }

            dialog.appendChild(container);
        }

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.className = "close-btn";
        closeBtn.textContent = "Close";
        closeBtn.addEventListener("click", () => {
            dialog.remove();
            overlay.remove();
        });
        dialog.appendChild(closeBtn);

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        // Click outside closes
        overlay.addEventListener("click", () => {
            dialog.remove();
            overlay.remove();
        });
    }
}

const userscriptSettings = new SettingsManager();

userscriptSettings.addSetting({ key: "enableHoverPreview", label: "Enable Hover Preview", defaultValue: true });
userscriptSettings.addSetting({ key: "enableFancyGallery", label: "Enable Fancybox Gallery", defaultValue: true });
userscriptSettings.addSetting({ key: "hoverPreviewDelay", label: "Hover Preview Delay (ms)", type: "number", defaultValue: 400 });

waitForElement("#piazza_homepage_id", el => {
    const settingsButton = document.createElement("a");
    settingsButton.href = "#";
    settingsButton.textContent = "Userscript settings";
    settingsButton.className = "dropdown-item"; // match styling
    settingsButton.style.cursor = "pointer";

    // Open settings dialog when clicked
    settingsButton.addEventListener("click", e => {
        e.preventDefault();
        userscriptSettings.showDialog(); // your SettingsManager instance
    });

    // Insert it right after the original element
    el.insertAdjacentElement("afterend", settingsButton);
});

const imagesToMakeInteractive = "#qanda-content .render-html-content img";

function injectImageHover() {
    if (!userscriptSettings.get("enableHoverPreview")) {
        return;
    }
    let previewEl;
    let hoverTimer;
    let lastMouseX = 0;
    let lastMouseY = 0;

    document.addEventListener("mousemove", e => {
        // Always update last known mouse position
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (previewEl) {
            previewEl.style.top = lastMouseY + 20 + "px";
            previewEl.style.left = lastMouseX + 20 + "px";
        }
    });

    document.addEventListener("mouseover", e => {
        const img = e.target.closest(imagesToMakeInteractive);
        if (!img) return;

        // Start delay timer
        hoverTimer = setTimeout(() => {
            previewEl = document.createElement("div");
            previewEl.style.position = "absolute";
            previewEl.style.zIndex = "9999";
            previewEl.style.border = "1px solid #ccc";
            previewEl.style.background = "#fff";
            previewEl.style.padding = "4px";
            previewEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
            previewEl.style.borderRadius = "6px";

            const bigImg = document.createElement("img");
            bigImg.src = img.src;
            bigImg.style.maxWidth = "500px";
            bigImg.style.maxHeight = "500px";
            bigImg.style.display = "block";

            previewEl.appendChild(bigImg);
            document.body.appendChild(previewEl);

            // Place preview at last known mouse coordinates
            previewEl.style.top = lastMouseY + 20 + "px";
            previewEl.style.left = lastMouseX + 20 + "px";

            img.addEventListener("mouseout", () => {
                clearTimeout(hoverTimer);
                if (previewEl) {
                    previewEl.remove();
                    previewEl = null;
                }
            }, { once: true });
        }, 400); // delay in ms
    });

    document.addEventListener("mouseout", e => {
        const img = e.target.closest(imagesToMakeInteractive);
        if (img) {
            clearTimeout(hoverTimer);
        }
    });

}

function injectImageInteractivity() {
    const fancyboxVersion = "6.0";

    GM_addElement('link', {
        rel: 'stylesheet',
        href: `https://cdn.jsdelivr.net/npm/@fancyapps/ui@${fancyboxVersion}/dist/fancybox/fancybox.css`
    });

    GM_addElement('script', {
        src: `https://cdn.jsdelivr.net/npm/@fancyapps/ui@${fancyboxVersion}/dist/fancybox/fancybox.umd.js`
    });

    if (!userscriptSettings.get("enableFancyGallery")) {
        return;
    }

    document.addEventListener("click", event => {
        const clickedImg = event.target.closest(imagesToMakeInteractive);
        if (!clickedImg) return;

        event.preventDefault();

        const container = clickedImg.closest(".render-html-content") || document;
        const imgs = Array.from(container.querySelectorAll(imagesToMakeInteractive));

        const slides = imgs.map(img => ({
            src: img.src,
            thumbSrc: img.src,
            caption: img.alt || img.title || ""
        }));

        const startIndex = imgs.indexOf(clickedImg);

        Fancybox.show(slides, {
            startIndex,
            Toolbar: {
                display: ["zoom", "slideshow", "fullscreen", "download", "close"]
            }
        });
    });
}

injectEndorsementFix();
injectImageHover();
injectImageInteractivity();