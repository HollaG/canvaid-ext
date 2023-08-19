import { ResponseData } from "./types";

interface IAddBody {
    html: string;
    quizName: string;
    course: string;
    uid: string;
    canvasApiToken: string;
    courseId?: string;
    quizId?: string;
    extensionToken?: string;
}

interface ICheckBody {
    quizName: string;
    attemptNum: number;
    canvasApiToken: string;
    extensionToken: string;
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    function getDOM() {
        //console.log("inside getDOM func");
        const dom = document.documentElement.outerHTML;
        console.log({ dom });

        // get the quiz Title
        const quizTitle = document.getElementById("quiz_title")?.innerText;

        // get the attempt num
        chrome.runtime.sendMessage({
            dom: `<!DOCTYPE html>${dom}`,
            url: window.location.href,
            quizTitle: quizTitle || "",
        });
    }

    chrome.scripting
        .executeScript({
            target: { tabId: tab.id || 0 },
            func: getDOM,
        })
        .then(() => console.log("Injected a function!"));
});

let pageContent: IAddBody = {
    html: "",
    quizName: "",
    course: "",
    uid: "",
    canvasApiToken: "",
    extensionToken: "",
};
chrome.runtime.onMessage.addListener(function (
    request: {
        dom: string;
        url: string;
        quizTitle: string;
    },
    sender,
    sendResponse
) {
    console.log(
        sender.tab
            ? "from a content script: " + sender.tab.url
            : "from the extension"
    );

    console.log(request.dom);

    const htmlTxt = request.dom;
    const url = request.url;
    const quizTitle = request.quizTitle;
    // sign in if not
    // don't allow submit if no token

    // send api request to parse
    // need to include the CourseId and QuizID as this webpage doesn't have the URL

    const [courseId, quizId] = url.match(/\d+/g) || [];
    document.getElementById("course-id")!.innerText = courseId || "";
    document.getElementById("quiz-id")!.innerText = quizId;

    pageContent.html = htmlTxt;
    pageContent.courseId = courseId;
    pageContent.quizId = quizId;

    // var resp = request.info;
    // if (resp) {
    //     // document.getElementById("result")!.innerText = resp;
    //     sendResponse({ farewell: "thanks for sending! goodbye" });
    // }

    console.log(url);
    if (url.match(/courses\/\d+\/quizzes\/\d+/gm)) {
        console.log("match");

        // check if can submit by Post request
        // if can, then enable the button
        // fetch("https://canvaid.com/api/add/check", {
        //     method: "POST",
        //     body: JSON.stringify({
        //         attemptNum: 1,
        //         canvasApiToken: pageContent.canvasApiToken,
        //         extensionToken: pageContent.extensionToken,
        //         quizName: quizTitle,
        //     } as ICheckBody),
        // });

        // enable the button
        submitBtn!.removeAttribute("disabled");
        submitBtn!.innerText = "Add Quiz";
    } else {
        quizDetailsDiv!.style.display = "none";
        submitBtn!.setAttribute("disabled", "true");

        // display error message
        errorPageMsg!.style.display = "block";
    }
});

// ELEMENTS
const submitBtn = document.getElementById("add-quiz-btn");
const tokenInput = document.getElementById("token-input") as HTMLInputElement;
const quizLinkBtn = document.getElementById("quiz-btn");
const quizDetailsDiv = document.getElementById("quiz-details");

const errorTokenMsg = document.getElementById("error-token-msg");
const errorPageMsg = document.getElementById("error-page-msg");
const errorAlreadyAddedMsg = document.getElementById("error-added-already-msg");
const errorParsingMsg = document.getElementById("error-parse-msg");

const successAddMsg = document.getElementById("success-add-msg");

const getTokenLink = document.getElementById("get-token-link");

// load the users' Extension Token
chrome.storage.local.get(["token"], function (items) {
    //  items = [ { "yourBody": "myBody" } ]
    const token = items.token || "";

    tokenInput.value = token;

    const extensionToken = token.split("::")[0];
    const canvasToken = token.split("::")[1] || "";
    pageContent.canvasApiToken = canvasToken;
    pageContent.extensionToken = extensionToken;
});

function setToken(token: string) {
    chrome.storage.local.set({ token }).then(() => {
        console.log("Value is set");
    });
    if (pageContent) pageContent.canvasApiToken = token;
}

function submit() {
    console.log("Submit called");
    console.log(pageContent);

    if (!submitBtn) return;
    // set submit to loading
    submitBtn.setAttribute("disabled", "true");
    submitBtn.innerText = "Adding Quiz...";
    submitBtn.style.opacity = "0.5";
    submitBtn.style.cursor = "not-allowed";

    // Reset all the error messages
    errorTokenMsg!.style.display = "none";
    errorPageMsg!.style.display = "none";
    errorAlreadyAddedMsg!.style.display = "none";
    errorParsingMsg!.style.display = "none";

    fetch("https://canvaid.com/api/add", {
        method: "POST",
        body: JSON.stringify(pageContent),
    })
        .then((res) => {
            if (!res.ok) {
                console.log("Error!");
                return Promise.reject(res);
            }

            return res.json();
        })
        .then((data: ResponseData) => {
            console.log({ data });

            const quiz = data.quiz;
            const quizId = quiz.id;

            //
            // change the button into one that links to the quiz

            submitBtn.style.display = "none";

            quizLinkBtn!.style.display = "inline-block";
            quizLinkBtn!.style.backgroundColor = "#319795";
            // quizLinkBtn!.setAttribute(
            //     "href",
            //     `https://canvaid.com/uploads/${quizId}`
            // );
            quizLinkBtn?.addEventListener("click", () => {
                chrome.tabs.create({
                    url: `https://canvaid.com/uploads/${quizId}`,
                });
            });

            successAddMsg!.style.display = "block";
        })
        .catch((e) => {
            console.error(e);

            if (e.status === 401) {
                // report invalid token
                submitBtn.removeAttribute("disabled");
                submitBtn.innerText = "Add Quiz";
                errorTokenMsg!.style.display = "block";
            }

            if (e.status === 400) {
                // report wrong page
                submitBtn.style.display = "none";
                errorPageMsg!.style.display = "block";
            }

            if (e.status === 409) {
                // report already added
                submitBtn.style.display = "none";
                errorAlreadyAddedMsg!.style.display = "block";
            }

            // if (e.status === 400) {
            //     setErrorMessage(
            //         "Invalid HTML File! Please ensure you have the correct HTML file of the quiz."
            //     );
            // } else if (e.status === 401) {
            //     setErrorMessage(
            //         "Error accessing Canvas! Please ensure you have the correct Canvas API token. Change it by clicking the Change Canvas API Token button."
            //     );
            // } else {
            //     setErrorMessage(
            //         "You have already submitted this attempt!"
            //     );
            // }
        })
        .finally(() => {
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        });
}

window.addEventListener("load", () => {
    getTokenLink?.addEventListener("click", () => {
        chrome.tabs.create({
            url: "https://canvaid.com/extension",
        });
    });

    tokenInput?.addEventListener("keyup", (e) => {
        const token = (e.target as HTMLInputElement).value;
        setToken(token);
    });

    submitBtn?.addEventListener("click", submit);
});
