// ==UserScript==
// @name         Piazza Revert
// @namespace    https://github.com/embeddedt
// @version      0.1
// @description  Revert Piazza to the old user interface
// @author       embeddedt
// @match        https://piazza.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=piazza.com
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

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

    GM_addStyle(`
        /* remove fixation on 1536px width */
        #react_root .folderbar-wrapper, #topbar, .main-content #content-holder, .main-content .questions-and-answers #qanda-content > div {
            max-width: none;
        }


        /* use legacy font */
        #react_root, .btn {
            font-family: "Helvetica Neue",Helvetica,Arial,sans-serif;
        }

        #react_feed #feed_list_wrapper #feed_list ul li.feed_item .content .snippet {
            font-family: "Lucida Grande",Lucida,Tahoma,Verdana,Arial,sans-serif;
            color: #666;
        }

        #feed_search_bar {
            max-width: 400px;
        }

        /* move menu items next to course name */
        #site-nav {
            margin-left: 0 !important;
        }

        .class-menu-wrapper {
            margin-left: 10em;
        }

        #react_feed {
            padding: 0;
        }

        #qanda-content > div > hr {
           border-top: none;
        }

        * {
            letter-spacing: normal !important;
        }

        /* fix QA section */
        .main-content .questions-and-answers {
            background-color: #eaeef4;
        }

        #react_feed + .questions-and-answers #qanda-content {
            margin-left: 0px;
        }

        #qanda-content {
            padding: 0 8px;
        }

        .main-content .questions-and-answers #qanda-content #post-header {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }

        .main-content .questions-and-answers #qanda-content .post-footer {
            background: none;
        }

        .main-content .questions-and-answers #qanda-content article#qaContentViewId {
            border-top-left-radius: 0;
            border-top-right-radius: 0;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
        }

        article.followup_container > header {
            padding-top: 1rem;
        }

        .followup.private {
            border: 9px solid #343a40;
        }

        .followup.private .badge.bg-dark {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }
    `);

    injectEndorsementFix();
})();
