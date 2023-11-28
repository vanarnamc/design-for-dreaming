import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

let objectDetector;
let runningMode = "IMAGE";
const demosSection = document.getElementById("demos");
const liveView = document.getElementById("liveView");
const video = document.getElementById("webcam");
let children = [];

const fullWindowButton = document.getElementById('fullWindowButton');
fullWindowButton.addEventListener('click', toggleFullWindow);

// Initialize the object detector
const initializeObjectDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm");
    objectDetector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
        },
        scoreThreshold: 0.4,
        runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
};
initializeObjectDetector();

// Check if webcam access is supported and set up the welcome text as clickable
function setupCameraAccess() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const welcomeText = document.getElementById("welcomeText");
        welcomeText.addEventListener("click", enableCam);
    } else {
        console.warn("getUserMedia() is not supported by your browser");
    }
}
setupCameraAccess();

async function enableCam(event) {
    // Check if the object detector is loaded
    if (!objectDetector) {
        console.log("Wait! ObjectDetector not loaded yet.");
        return;
    }

    // Set the source of the video element to your video file
    video.src = 'media/DesignforDreaming.mp4'; // Replace with your video file path
    video.loop = true; // Enable looping of the video

    // Add an event listener for when the video's metadata is loaded
    video.addEventListener('loadedmetadata', function() {
        // Set the video's current time to a random position
        video.currentTime = Math.random() * video.duration;
    });

    video.play(); // Start playing the video

    // Add the 'loadeddata' event listener to start detection when the video is ready
    video.addEventListener("loadeddata", predictWebcam);

    // Hide the welcome screen and show the main content
    document.getElementById('welcomeScreen').style.display = 'none';
}



let lastVideoTime = -1;
async function predictWebcam() {
    // if image mode is initialized, create a new classifier with video runningMode.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    let startTimeMs = performance.now();
    // Detect objects using detectForVideo.
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = objectDetector.detectForVideo(video, startTimeMs);
        displayVideoDetections(detections);
    }
    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
}
function displayVideoDetections(result) {
    // Clear out previous detections
    children.forEach(child => liveView.removeChild(child));
    children.splice(0);

    // Get the computed styles of the video container
    let videoContainerStyle = window.getComputedStyle(document.getElementById('videoContainer'));
    let videoContainerMarginLeft = parseFloat(videoContainerStyle.marginLeft);
    let videoContainerMarginTop = parseFloat(videoContainerStyle.marginTop);

    // Get the current size of the video and its container
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;
    let displayWidth = video.offsetWidth - (videoContainerMarginLeft * 2); // Subtract margin from total width
    let displayHeight = video.offsetHeight - (videoContainerMarginTop * 2); // Subtract margin from total height

    // Calculate scale factors based on the current size
    let scaleX = displayWidth / videoWidth;
    let scaleY = displayHeight / videoHeight;

    // Iterate over each detection result
    result.detections.forEach(detection => {
        let scaledX = detection.boundingBox.originX * scaleX + videoContainerMarginLeft;
        let scaledY = detection.boundingBox.originY * scaleY + videoContainerMarginTop;
        let scaledWidth = detection.boundingBox.width * scaleX;
        let scaledHeight = detection.boundingBox.height * scaleY;

        // Create the highlighter box
        const highlighter = document.createElement("div");
        highlighter.setAttribute("class", "highlighter");

        // Check if the detected object is a human
        if (detection.categories[0].categoryName.toLowerCase() === 'person') {
            highlighter.classList.add("person-highlight"); // Add a class for human detections
        }

        highlighter.style.left = `${scaledX}px`;
        highlighter.style.top = `${scaledY}px`;
        highlighter.style.width = `${scaledWidth}px`;
        highlighter.style.height = `${scaledHeight}px`;

        // Append highlighter to the live view
        liveView.appendChild(highlighter);

        // Create and style the label
        const label = document.createElement("p");
        label.setAttribute("class", "detection-label");
        label.innerText = `${detection.categories[0].categoryName.toUpperCase()} - ${Math.round(parseFloat(detection.categories[0].score) * 100)}%`;

        // Calculate the center position
        const centerX = scaledX + scaledWidth / 2;
        const centerY = scaledY + scaledHeight / 2;

        // Position the label at the center of the highlighter box
        label.style.left = `${centerX}px`;
        label.style.top = `${centerY}px`;

        // Append label to the live view
        liveView.appendChild(label);

        // Store elements for removal in the next frame
        children.push(highlighter, label);
    });
}




function updateDetectionPositions() {
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;
    let displayWidth = video.offsetWidth;
    let displayHeight = video.offsetHeight;

    // Calculate the aspect ratio of the video
    let aspectRatio = videoWidth / videoHeight;
    let displayAspectRatio = displayWidth / displayHeight;

    let scaleY;
    let offsetX = 0; // Initialize offsetX to 0 if it's not used elsewhere
    let offsetY; // This will hold any vertical offset

    // Check if there is letterboxing
    if (aspectRatio > displayAspectRatio) {
        // Width is the limiting factor
        scaleY = displayWidth / videoWidth;
        offsetY = (displayHeight - (displayWidth / aspectRatio)) / 2; // Calculate the vertical offset
    } else {
        // Height is the limiting factor
        scaleY = displayHeight / videoHeight;
        offsetY = 0; // No vertical offset in this case
    }
    let scaleX = displayWidth / videoWidth;

    children.forEach(child => {
        let scaledX = (videoWidth - parseFloat(child.dataset.origX) - parseFloat(child.dataset.origWidth)) * scaleX + offsetX;
        let scaledY = parseFloat(child.dataset.origY) * scaleY + offsetY; // Apply the vertical offset here

        if (child.className === "highlighter") {
            // Update the position and size of the highlighter
            child.style.left = `${scaledX}px`;
            child.style.top = `${scaledY}px`;
            child.style.width = `${parseFloat(child.dataset.origWidth) * scaleX}px`;
            child.style.height = `${parseFloat(child.dataset.origHeight) * scaleY}px`;
        } else if (child.className === "detection-label") {
            // Update the position of the label
            child.style.left = `${scaledX + (parseFloat(child.dataset.origWidth) * scaleX) / 2}px`; // Center label horizontally
            child.style.top = `${scaledY + (parseFloat(child.dataset.origHeight) * scaleY) / 2}px`; // Center label vertically
        }
    });
}


let isFullWindow = false;

function toggleFullWindow() {
    let container = document.getElementById('videoContainer');
    let videoView = document.querySelector('.videoView');
    let fullWindowButton = document.getElementById('fullWindowButton'); // Get the button element
    isFullWindow = !isFullWindow;

    if (isFullWindow) {
        container.style.position = 'fixed';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.top = '0';
        container.style.left = '0';
        fullWindowButton.style.bottom = '10px';
        fullWindowButton.style.right = '10px';

        videoView.style.position = 'static';
        fullWindowButton.textContent = '↙ Toggle Full Window'; // Change text when in full window
    } else {
        container.style.position = 'relative';
        container.style.width = 'initial';
        container.style.height = 'initial';
        container.style.top = 'initial';
        container.style.left = 'initial';
        container.style.zIndex = 'initial';
        videoView.style.position = 'relative';
        fullWindowButton.style.bottom = '-25px';
        fullWindowButton.style.right = '0px';

        fullWindowButton.textContent = '↘ Toggle Full Window'; // Reset text when not in full window
    }

    updateDetectionPositions();
}


const muteButton = document.getElementById('muteButton');
const videoElement = document.getElementById('webcam'); // Assuming this is your video/audio element

muteButton.addEventListener('click', function() {
    videoElement.muted = !videoElement.muted; // Toggle the muted state
    muteButton.textContent = videoElement.muted ? 'UNMUTE' : 'MUTE'; // Update the button text
});

// After the objectDetector has been initialized
const confidenceRects = document.querySelectorAll('.confidenceRect');

// Set the initial scoreThreshold to match the fourth rectangle
const initialThreshold = 0.55;

// Update the object detector's score threshold to the initial value
if (objectDetector) {
  objectDetector.setOptions({ scoreThreshold: initialThreshold });
}

// Set the first four rectangles to active
confidenceRects.forEach(rect => {
  const value = parseFloat(rect.dataset.value);
  if (value >= initialThreshold) {
    rect.classList.add('active');
  }
});


confidenceRects.forEach(rect => {
  rect.addEventListener('click', function() {
    // Remove active class from all rectangles
    confidenceRects.forEach(r => r.classList.remove('active'));

    // Add active class to clicked rectangle and all rectangles to the left
    const clickedValue = parseFloat(this.dataset.value);
    for (const r of confidenceRects) {
      const value = parseFloat(r.dataset.value);
      if (value >= clickedValue) {
        r.classList.add('active');
      }
    }

    // Update the object detector's score threshold
    if (objectDetector) {
      objectDetector.setOptions({ scoreThreshold: clickedValue });
    }
  });
});

  
window.addEventListener('resize', function() {
    if (isFullWindow) {
        updateDetectionPositions();
    }
});


