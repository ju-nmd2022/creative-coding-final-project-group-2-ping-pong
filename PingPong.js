let handpose, faceMesh, video;
let hands = [], faces = []; poses = [];
let showFace = false, noEllipseTime = 0, faceZoomThreshold, hasZoomedFace = false;
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
let cornerX = 30, cornerY = 30; // always same corner it likes only ONE it wasnt because i am lazy

let gameStarted = false;

let easingToCenter = false;



function preload() {
  handpose = ml5.handPose({ flipHorizontal: true });
  faceMesh = ml5.faceMesh();
  bodyPose = ml5.bodyPose();
}

function setup() {
  createCanvas(620, 480); // windowWidth, windowHeight doesnt work because of the facecamm zoom .. 1512, 830 - my window size also...... IDK
  // createCanvas(windowWidth, windowHeight); // facezoom problem but fullsize
  startTime = millis();
  video = createCapture(VIDEO);
  video.size(620, 480); // innerWidth, innerHeight problems facezoom
  // video.size(windowWidth, windowHeight); // facezoom problem but fullsize
  video.hide();
 

  handpose.detectStart(video, getHandsData);
  faceMesh.detectStart(video, getFacesData);
  bodyPose.detectStart(video, gotPoses);
  
  setupSynths();
  setupToneLoop();
  Tone.Transport.start();

  checkWeekday(getWeekday());
  console.log(faceZoomThreshold + "facezoomthreshold");

  
}

function draw() {
  background(23, 31, 38); 

  if (!gameStarted) {
    if (millis() - startTime > 5000) {
      gameStarted = true;
    } else {
      fill(255);
      textSize(32);
      textAlign(CENTER, CENTER);
      text("Approve your camera!", width / 2, height / 2);
      return; 
    }
  }

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
    easingToCenter = true; // Set the flag when there are multiple people
} else {
    if (easingToCenter) {
        // try to ease it in the middle, before that code it just vanished??
        x = lerp(x, 640 / 2, 0.1);
        y = lerp(y, 480 / 2, 0.1);
        
        // Close o center calculation by gpt  ITS A FEATURE NOT A BUG it spawns in the center after it was too scared
        if (abs(x - 640 / 2) < 1 && abs(y - 480 / 2) < 1) {
            easingToCenter = false; // Stop easing once it's in the center
            x = 640 / 2; 
            y = 480 / 2;
        }
    } else {
        handleBallMovement();
    }
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

// hand collision ball
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
// face zoom logic (when it happens) copilot help
function manageFaceZoom(detectedEllipsesCount) {
  if (detectedEllipsesCount === 0) {
    noEllipseTime += deltaTime;
    if (noEllipseTime >= faceZoomThreshold && !hasZoomFactorIncreased) {
      showFace = true;
      hasZoomedFace = true;
      zoomFactor = zoomFactor + random(0.5,1);
      hasZoomFactorIncreased = true;
    }
  } else {
    noEllipseTime = 0;
    showFace = false;
    hasZoomFactorIncreased = false;
  }
}


// zoom face copilot help
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
        ellipseRadius = random(50,60); 
        anger = anger + random(30,40);
        faceZoomThreshold = random(10000,12000); 
        break;
    case "Tuesday": 
        ellipseRadius = random(70,80); 
        anger = anger + random(20,30);
        faceZoomThreshold = random(9000,11000); 
        break;
    case "Wednesday": 
        ellipseRadius = random(80,90);
        anger = anger + random(15,20);
        faceZoomThreshold = random(8000,10000); 
        break;
    case "Thursday": 
        ellipseRadius = random(100,110); 
        anger = anger + random(12,18);
        faceZoomThreshold = random(7000,9000);
        break;
    case "Friday": 
        ellipseRadius = random(120,130);
        anger = anger + random(10,15);
        faceZoomThreshold = random(6000,8000); 
        break;
    case "Saturday": 
        ellipseRadius = random(130,140); 
        anger = anger - random(10,15);
        faceZoomThreshold = random(5000,7000); 
        break;
    case "Sunday": 
        ellipseRadius = random(150,170);
        anger = anger - random(20,30);
        faceZoomThreshold = random(4000,6000); 
        break; // ellipseRadius = confidence (maybe it can get less hits)
    default: ellipseRadius = random(80,100);
            faceZoomThreshold = random(6000,8000);
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

// dark sound when easing I THINK YOU DESTROY MY TONE i hate tonejs
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
      suppressEndTime = millis() + 3000; // still not working well with surpresstime changes
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


function drawEllipse(centerX, centerY, distance) {
  noStroke();
  fill(249, 199, 79); //   fill(0, 0, 255, 150);   FINGER ELLIPSE
  ellipse(centerX, centerY, distance);
}


// Error: Start time must be strictly greater than previous start time 
// is appearing sometimes. Should be a tonejs problem, but I couldn't fix it yet.
// sometimes it appears earlier than other times, so for now just restart!