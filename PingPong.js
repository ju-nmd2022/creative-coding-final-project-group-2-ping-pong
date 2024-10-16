let handpose, faceMesh, video;
let hands = [], faces = []; poses = [];
let showFace = false, noEllipseTime = 0, faceZoomThreshold = 10000, hasZoomedFace = false;
let pentatonicScale = ["C4", "D4", "E4", "G4", "A4"];
let synth, darkSynth, noteLoop, isPlaying = false, currentNote = "C4";
let suppressSound = false, suppressEndTime = 0, darkSoundTriggered = false, isPaused = false;
let anger = 0, totalHits = 0, useAdjustBallSpeed = false;

let hasZoomFactorIncreased = false;

let x = 100, y = 100, speedX = 5, speedY = 8, ellipseRadius = 80;
let lastCollisionTime = 0, collisionCooldown = 300;

const weekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let zoomFactor = 5;

let isShaking = false; // only for ball in corner
let shakeAmount = 5;
let cornerX = 30, cornerY = 30;


function preload() {
  handpose = ml5.handPose({ flipHorizontal: true });
  faceMesh = ml5.faceMesh();
  bodyPose = ml5.bodyPose();
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handpose.detectStart(video, getHandsData);
  faceMesh.detectStart(video, getFacesData);
  bodyPose.detectStart(video, gotPoses);
  
  setupSynths();
  setupToneLoop();
  Tone.Transport.start();

  checkWeekday(getWeekday());
}

function draw() {
  background(23, 31, 38); // BACKGROUND
  let detectedEllipses = [];

  let numberOfPeople = poses.length;


  hands.forEach(hand => {
    let { centerX, centerY, distance } = calculateHandEllipse(hand);
    detectedEllipses.push({ centerX, centerY, distance });

    drawEllipse(centerX, centerY, distance);
    handleCollisionWithBall(centerX, centerY, distance);
  });

  manageFaceZoom(detectedEllipses.length);
  manageEasingAndShake(detectedEllipses);
  manageDarkSoundAndLoop(detectedEllipses);

  if (showFace) {
    drawZoomedFace();
  }

if (numberOfPeople > 1) {
    moveToCornerWithShake();
  } else {
    handleBallMovement();
  }
}



  function gotPoses(results) {
    poses = results;
  }
// normal synth playing at beginning, after easing and facezoom stop..
function setupSynths() {
  synth = new Tone.Synth().toDestination();
  darkSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.5, decay: 1, sustain: 0.5, release: 1 }
  }).toDestination();
}
// tone loop with copilot to try fixing error
function setupToneLoop() {
  noteLoop = new Tone.Loop(time => {
    synth.triggerAttackRelease(currentNote, "8n", time);
  }, "8n");
}

function getHandsData(results) {
  hands = results;
}

function getFacesData(results) {
  faces = results;
}
// code from lecture
function calculateHandEllipse(hand) {
  let indexFinger = hand.index_finger_tip;
  let thumb = hand.thumb_tip;
  let centerX = (indexFinger.x + thumb.x) / 2;
  let centerY = (indexFinger.y + thumb.y) / 2;
  let distance = dist(indexFinger.x, indexFinger.y, thumb.x, thumb.y);

  if (useAdjustBallSpeed) {
    adjustBallSpeed(distance);
  }

  return { centerX, centerY, distance };
}


// play note from grid but with ellipse not used anymore
function playNoteFromGrid(x, y) {
  let noteIndex = (x + y * 8) % pentatonicScale.length;
  let note = pentatonicScale[noteIndex];
  synth.triggerAttackRelease(note, "8n");
}
// hand collision ball)
function handleCollisionWithBall(centerX, centerY, distance) {
  let distanceToBall = dist(centerX, centerY, x, y);
  if (distanceToBall < distance / 2 + ellipseRadius / 2) {
    let currentTime = millis();
    if (currentTime - lastCollisionTime > collisionCooldown) {
      speedX *= -1;
      speedY *= -1;
      anger = min(100, anger + 10);
      playNoteFromGrid(x, y);
      lastCollisionTime = currentTime;

      totalHits++;
      toggleBallSpeedOnHits();
    }
  }
}
// hide corner shake(fear)
function moveToCornerWithShake() {
    x = lerp(x, cornerX, 0.1);
    y = lerp(y, cornerY, 0.1);
  
    let shakeAmount = 2;
    x += random(-shakeAmount, shakeAmount);
    y += random(-shakeAmount, shakeAmount);
  

    fill(224, 170, 255, 100); // fear
    ellipse(x, y, ellipseRadius);
  }

  // if enough hits and face zoomed, toggle ball speed possibility 50 &
function toggleBallSpeedOnHits() {
  if (totalHits % 2 === 1 && hasZoomedFace) {
    useAdjustBallSpeed = random() < 0.5;
  } else if (totalHits % 2 === 0) {
    useAdjustBallSpeed = false;
  }
}
// ball speed change
function adjustBallSpeed(distance) {
  let minDistance = 10, maxDistance = 200, minSpeed = 9, maxSpeed = 2;
  let newSpeed = map(distance, minDistance, maxDistance, minSpeed, maxSpeed);
  newSpeed = constrain(newSpeed, maxSpeed, minSpeed);

  speedX = Math.sign(speedX) * newSpeed;
  speedY = Math.sign(speedY) * newSpeed;
}
// face zoom logic (when it happens) 
function manageFaceZoom(detectedEllipsesCount) {
  if (detectedEllipsesCount === 0) {
    noEllipseTime += deltaTime;
    if (noEllipseTime >= faceZoomThreshold && !hasZoomFactorIncreased) {
      showFace = true;
      hasZoomedFace = true;
      zoomFactor = zoomFactor + 0.5;
      hasZoomFactorIncreased = true;
    }
  } else {
    noEllipseTime = 0;
    showFace = false;
    hasZoomFactorIncreased = false;
  }
}


// zoom face
function drawZoomedFace() {
  if (faces.length > 0) {
    let face = faces[0];
    let { centerX, centerY } = getFaceCenter(face);
    let zoomedWidth = width / zoomFactor;
    let zoomedHeight = height / zoomFactor;

    let zoomX = constrain(centerX - zoomedWidth / 2, 0, video.width - zoomedWidth);
    let zoomY = constrain(centerY - zoomedHeight / 2, 0, video.height - zoomedHeight);

    image(video, 0, 0, width, height, zoomX, zoomY, zoomedWidth, zoomedHeight);
  }
}
// face center for tracking
function getFaceCenter(face) {
  if (face.annotations && face.annotations.silhouette) {
    let faceCenter = face.annotations.silhouette[0];
    return { centerX: faceCenter[0], centerY: faceCenter[1] };
  } else if (face.box) {
    return {
      centerX: (face.box.xMin + face.box.xMax) / 2,
      centerY: (face.box.yMin + face.box.yMax) / 2
    };
  }
  return { centerX: 0, centerY: 0 };
}
// week day check
function checkWeekday(day) {
  switch (day) {
    case "Monday": 
        ellipseRadius = 60; 
        anger = anger + 30
        break;
    case "Tuesday": 
        ellipseRadius = 80; 
        anger = anger + 20
        break;
    case "Wednesday": 
        ellipseRadius = 90;
        anger = anger + 18
        break;
    case "Thursday": 
        ellipseRadius = 100; 
        anger = anger + 15
        break;
    case "Friday": 
        ellipseRadius = 140;
        anger = anger + 10
        break;
    case "Saturday": 
        ellipseRadius = 150; 
        anger = anger - 10;
        break;
    case "Sunday": 
        ellipseRadius = 170;
        anger = anger - 20;
        break; // ellipseRadius = confidence (maybe it can get less hits)
    default: ellipseRadius = 80;
  }
}
// weekday js check
function getWeekday() {
  return weekday[new Date().getDay()];
}
// easing and shake going away with two hands
function manageEasingAndShake(detectedEllipses) {
  if (detectedEllipses.length >= 2) {
    let targetX = (detectedEllipses[0].centerX + detectedEllipses[1].centerX) / 2;
    let targetY = (detectedEllipses[0].centerY + detectedEllipses[1].centerY) / 2;
    x = lerp(x, targetX, 0.1);
    y = lerp(y, targetY, 0.1);
    speedX = 2;
    speedY = 3;
    if (anger > 60) {
      let shakeAmount = map(anger, 60, 100, 2, 10); // ANGRY AND DEFAULT BALL
      x += random(-shakeAmount, shakeAmount);
      y += random(-shakeAmount, shakeAmount);
    }
    anger = max(0, anger - 0.5);
  }
}

// dark sound when easing
function manageDarkSoundAndLoop(detectedEllipses) {
  if (detectedEllipses.length >= 2) {
    if (!darkSoundTriggered) {
      darkSynth.triggerAttack("C2");
      darkSoundTriggered = true;
      suppressSound = true;
    }
    if (isPlaying) {
      noteLoop.stop();
      isPlaying = false;
    }
    isPaused = true;
  } else if (isPaused) {
    if (darkSoundTriggered) {
      darkSynth.triggerRelease();
      suppressSound = true;
      suppressEndTime = millis() + 3000;
      darkSoundTriggered = false;
    }
    speedX = 5;
    speedY = 8;
    if (!isPlaying && millis() > suppressEndTime) {
      noteLoop.start();
      isPlaying = true;
    }
    isPaused = false;
  }
}

// ball movement and shake
function handleBallMovement() {
  if (anger > 60) {
    let shakeAmount = map(anger, 60, 100, 5, 20);
    x += random(-shakeAmount, shakeAmount);
    y += random(-shakeAmount, shakeAmount);
  }
  

  x += speedX;
  y += speedY;

  if (x + ellipseRadius / 2 >= width || x - ellipseRadius / 2 <= 0) {
    speedX *= -1;
    playNoteFromGrid(x, y);
  }
  if (y + ellipseRadius / 2 >= height || y - ellipseRadius / 2 <= 0) {
    speedY *= -1;
    playNoteFromGrid(x, y);
  }

  let redValue = map(anger, 0, 100, 0, 255);
  fill(redValue, 110, 68);
  ellipse(x, y, ellipseRadius);
}

// HAND ELLIPSE OUT OF LECTURE
function calculateHandEllipse(hand) {
  let indexFinger = hand.index_finger_tip;
  let thumb = hand.thumb_tip;
  let centerX = (indexFinger.x + thumb.x) / 2;
  let centerY = (indexFinger.y + thumb.y) / 2;
  let distance = dist(indexFinger.x, indexFinger.y, thumb.x, thumb.y);

  if (useAdjustBallSpeed) { //only after facezoom and uneven total hit number 50 %
    adjustBallSpeed(distance);
  }

  return { centerX, centerY, distance };
}

function drawEllipse(centerX, centerY, distance) {
  noStroke();
  fill(249, 199, 79); //   fill(0, 0, 255, 150);   FINGER ELLIPSE
  ellipse(centerX, centerY, distance);
}
