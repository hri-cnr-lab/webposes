
var net, brain, projectID, networkID, dataType, model, inputs, labels;

const videoDim = 514;
const keypointsParts = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip'];

const adiacentKeypointsIndexes = [  6, // 'leftHip', 
                                    0, // 'leftShoulder'
                                    0, // 'leftShoulder'
                                    1, // 'rightShoulder'
                                    2, // 'leftElbow'
                                    3, // 'rightElbow'
                                    7, // 'rightHip'
                                    1  //'rightShoulder'
];

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.querySelector('video');
  video.width = videoDim;
  video.height = videoDim;

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: videoDim,
      height: videoDim,
    },
  });
  
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

// Draw ellipses over the detected keypoints
function drawKeypoints(pose, ctx)  {
  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];

    // Only draw an ellipse is the pose probability is bigger than 0.2
    if (keypoint.score > 0.2) {
      ctx.fillStyle = 'red'; 
      ctx.beginPath();
      ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'red';
      ctx.stroke();
    }
  }
}

function drawSegment([ax, ay], [bx, by], color, scale, ctx) {
  ctx.beginPath();
  ctx.moveTo(ax * scale, ay * scale);
  ctx.lineTo(bx * scale, by * scale);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function toTuple({x, y}) {
  return [x, y];
}

// Draw the skeletons
function drawSkeleton(pose, ctx) {
  const adjacentKeyPoints = posenet.getAdjacentKeyPoints(pose.keypoints, 0.2);

  adjacentKeyPoints.forEach((keypoints) => {
    drawSegment(toTuple(keypoints[0].position), toTuple(keypoints[1].position), 'green', 1, ctx);
  });
}

function filterPose(pose) {
  let filteredPose = {};
  let filteredKeypoints = [];

  filteredPose.score = pose.score;

  for (let i = 0; i < pose.keypoints.length; i++) {
    let part = pose.keypoints[i].part;
    if (keypointsParts.includes(part))
      filteredKeypoints.push(pose.keypoints[i]);
  }
  filteredPose.keypoints = filteredKeypoints;

  return filteredPose;
}

function round(n) {
  return Math.round( n * 100 + Number.EPSILON ) / 100;
}

function jointsAngle(a, b, c) {
  let mAB = (b.y - a.y) / (b.x - a.x);
  let mBC = (c.y - b.y) / (c.x - b.x);

  let angle = Math.atan2((mBC - mAB), (1 + mBC * mAB)) * 180 / Math.PI;

  if (angle < 0)
    angle = 180 + angle;

  return angle;
}

function calc3jointsAngles(pose) {
  let leftShoulder = pose.keypoints[0].position;
  let rightShoulder = pose.keypoints[1].position;
  let leftElbow = pose.keypoints[2].position;
  let rightElbow = pose.keypoints[3].position;
  let leftWrist = pose.keypoints[4].position;
  let rightWrist = pose.keypoints[5].position;
  let leftHip = pose.keypoints[6].position;
  let rightHip = pose.keypoints[7].position;

  let rightShoulderAngle = jointsAngle(rightHip, rightShoulder, rightElbow);
  let rightShoulderInnerAngle = jointsAngle(rightHip, rightShoulder, leftShoulder);
  let rightElbowAngle = jointsAngle(rightShoulder, rightElbow, rightWrist);
  let rightHipAngle = jointsAngle(leftHip, rightHip, rightShoulder);

  let leftShoulderAngle = jointsAngle(leftHip, leftShoulder, leftElbow);
  let leftShoulderInnerAngle = jointsAngle(leftHip, leftShoulder, rightShoulder);
  let leftElbowAngle = jointsAngle(leftShoulder, leftElbow, leftWrist);
  let leftHipAngle = jointsAngle(rightHip, leftHip, leftShoulder);

  let inputs = [ 
    round(rightShoulderAngle), round(rightShoulderInnerAngle), round(rightElbowAngle), round(leftShoulderAngle),
    round(leftShoulderInnerAngle), round(leftElbowAngle), round(rightHipAngle), round(leftHipAngle)
  ];

  return inputs;
}

function translatedJointAngle(a, o) {
  let x = a.x - o.x;
  let y = a.y - o.y;

  let angle = Math.atan2(y, x) * 180 / Math.PI;

  if (angle < 0)
    angle = 180 + angle;

  return angle;
}

function calcTranslatedJointsAngles(pose) {
  let inputs = [];

  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    let adiacentIndex = adiacentKeypointsIndexes[j];
    let adiacentKeypoint = pose.keypoints[adiacentIndex];

    let t_angle = translatedJointAngle(keypoint.position, adiacentKeypoint.position);

    inputs.push(t_angle);
  }

  return inputs;
}

function makeInputs(pose) {
  let inputs = [];

  //console.log(pose);

  switch (dataType) {
    case 'Keypoints':
      for (let i = 0; i < pose.keypoints.length; i++) {
        let x = pose.keypoints[i].position.x;
        let y = pose.keypoints[i].position.y;
        inputs.push(x);
        inputs.push(y);
      }
      break;

    case '3-joints angles':
        inputs = calc3jointsAngles(pose);
        break;

    case 'T-joints angles':
        inputs = calcTranslatedJointsAngles(pose);
  }

  return inputs;
}

function detectPoses(video) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const classifyPoses = document.getElementById('classifyPoses');

  async function posesDetection() {
    let minPoseConfidence;
    let minPartConfidence;
    let spose, pose;

    if (classifyPoses.checked) {
      // single-pose
      spose = await net.estimateSinglePose(video, {
        flipHorizontal: 'true'
      });

      pose = filterPose(spose);

      drawKeypoints(pose, ctx);
      drawSkeleton(spose, ctx);
    }

    // Draw the video element into the canvas
    ctx.clearRect(0, 0, videoDim, videoDim);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-video.width, 0);
    ctx.drawImage(video, 0, 0, videoDim, videoDim);
    ctx.restore();

    if (classifyPoses.checked) {
      drawKeypoints(pose, ctx);
      drawSkeleton(spose, ctx);

      if (pose.score > 0.70) {
        let inputs = makeInputs(pose);
        classify(inputs);
      }
    }

    window.requestAnimationFrame(posesDetection);
  }

  posesDetection();
}

function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }

  let poseLabel = '';

  if (!isNaN(results[0].confidence)) { // > 0.85) {
    poseLabel = results[0].label.toUpperCase() + ' (' + round(results[0].confidence) + '%)';
  }

  document.getElementById('target').innerHTML = "<h2>" + poseLabel + "</h2>";
}


function classify(input) {
  const maxVal = (dataType == 'Keypoints') ? videoDim : 180;
  const normalizedInput = input.map(x => {
    return x / maxVal;
  });

  console.log(input, normalizedInput);

  return tf.tidy(() => {

    const inputTensor = tf.tensor2d([normalizedInput]);

    let results = model.predict(inputTensor);
    let argMax = results.argMax(1);
    let index = argMax.dataSync()[0];
    let confidence = results.dataSync()[index];

    let score = (confidence > 0.70) ? Math.round(confidence * 10000) / 100 : '';
    let label = (confidence > 0.70) ? labels[index] : '';

    document.getElementById('target').innerHTML = label;
    document.getElementById('score').innerHTML = score;

    console.log(results.dataSync(), argMax.dataSync(), label);

    return label;
  });
}

async function getData(url) {
  const poseDataReq = await fetch(url);
  const poseData = await poseDataReq.json();
  return poseData;
}

function populateKeypointsTable() {
  for (let i=0; i<keypointsParts.length; i++) {
    $('#keypointsTable').find('tbody').append("<tr><td>" + keypointsParts[i] + "</td><td id='td" + keypointsParts[i] + "'>-</td></tr>");
  }
}

async function main() {
  projectID = $.urlParam('project');
  networkID = $.urlParam('network');

  if ((projectID == null) || (networkID == null)) {
    window.location.replace('/');
    return;
  }

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    console.log('this browser does not support video capture, or this device does not have a camera');
    throw e;
  }

  document.getElementById("close").onclick = function() { window.location.replace('index.html?project=' + projectID); };

  loadJSON('/getPosenetConfig?id=' + projectID, function(text) {
    let netConfig = JSON.parse(text);

    (async() => {
      net = await posenet.load(netConfig);
    })().then(() => {
    });

  });

  loadJSON('/getNetworkInfo?id=' + networkID, async function(text) {
    const networkInfo = JSON.parse(text);

    dataType = networkInfo.type;
    //console.log(dataType);  
  
    inputs = networkInfo.options.inputs;
    labels = networkInfo.options.outputs;
  
    model = await tf.loadLayersModel('models/' + projectID + '/' + networkID + '.json');
    model.summary();
  
    populateKeypointsTable();
  
    detectPoses(video);
  });

  /*
  const posenetOptions = await getData('/getPosenetConfig?id=' + projectID);
  //console.log(posenetOptions);

  net = await posenet.load(posenetOptions);

  const networkInfo = await getData('/getNetworkInfo?id=' + networkID);
  //console.log(networkInfo);

  dataType = networkInfo.type;
  //console.log(dataType);  

  inputs = networkInfo.options.inputs;
  labels = networkInfo.options.outputs;

  model = await tf.loadLayersModel('/models/' + projectID + '/' + networkID + '.json');
  model.summary();

  populateKeypointsTable();

  detectPoses(video);
  */
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

document.addEventListener("DOMContentLoaded", function() {
  main();
});
