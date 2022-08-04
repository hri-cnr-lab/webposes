

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

const jointsAngles = ['leftShoulderAngle', 'leftShoulderInnerAngle', 'rightShoulderAngle', 'rightShoulderInnerAngle', 'leftElbowAngle', 'rightElbowAngle', 'leftHipAngle', 'rightHipAngle'];
const valuesDivs = ['', 'keypointsDiv', 'anglesDiv', 'translatedDiv'];

const defaultWarningTime = 10;
const defaultCollectTime = 20;

var memory = [];
var memoryCounters = [];
var collecting = false;
//var datasetType = 0;
let countdownEnabled = false;

var projectID = null;
var datafileID = null;
var net = null;

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

// Draw the skeletons
function drawSkeleton(pose, ctx) {
  const adjacentKeyPoints = posenet.getAdjacentKeyPoints(pose.keypoints, 0.2);

  adjacentKeyPoints.forEach((keypoints) => {
    drawSegment(toTuple(keypoints[0].position), toTuple(keypoints[1].position), 'green', 1, ctx);
  });
}

function toTuple({x, y}) {
  return [x, y];
}

function drawSegment([ax, ay], [bx, by], color, scale, ctx) {
  ctx.beginPath();
  ctx.moveTo(ax * scale, ay * scale);
  ctx.lineTo(bx * scale, by * scale);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
}


function setCollecting() {
  collecting = true;
  countdownEnabled = false;

  if (memory.length == 0)
    createAllCounters();

  let collectTime = Number(document.getElementById('collectTime').value);
  
  if (isNaN(collectTime))
    collectTime = defaultCollectTime;

  alertify.success('Collecting...', collectTime, unsetCollecting);
}

function unsetCollecting() {
  collecting = false;
  $('#collectPoses').prop('checked', false).change();
  $('#estimatePoses').prop('checked', false).change();
}


function createAllCounters() {
  document.getElementById("countersDiv").style.display = 'block';
  document.getElementById("buttonsDiv").style.display = 'block';

  memory.forEach(function(memoryEntry) {
    showCounters(memoryEntry.target);
  });
}

function showCounters(target) {
  let countersTable = document.getElementById("countersTable");

  if (memoryCounters[target]) {
    memoryCounters[target] = memoryCounters[target]+1;
    document.getElementById("td" + target).innerHTML = memoryCounters[target];
  }
  else {
    memoryCounters[target] = 1;
    $('#countersTable').find('tbody').append("<tr><td>" + target + "</td><td id='td" + target + "'>1</td></tr>");
  }
}

function collect(pose, target) {
  let memoryEntry = { "target" : target , "pose" : pose };

  memory.push(memoryEntry);

  showCounters(target);
}

function filterPose(pose) {
  let filteredPose = {};
  let filteredKeypoints = [];

  filteredPose.score = Math.round(pose.score * 100);

  for (let i = 0; i < pose.keypoints.length; i++) {
    let part = pose.keypoints[i].part;
    if (keypointsParts.includes(part)) {
      pose.keypoints[i].position.x = Math.round(pose.keypoints[i].position.x);
      pose.keypoints[i].position.y = Math.round(pose.keypoints[i].position.y);
      filteredKeypoints.push(pose.keypoints[i]);
    }
  }
  filteredPose.keypoints = filteredKeypoints;

  return filteredPose;
}

function showEstimatedValues(pose) {
  //console.log(pose);
  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    document.getElementById("td" + keypoint.part).innerHTML = keypoint.position.x + ", " + keypoint.position.y;
  }

  document.getElementById("scoreTD").innerHTML = pose.score + ' %';
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

  let values = [
    { 'name' : 'rightShoulderAngle', 'value' : rightShoulderAngle },
    { 'name' : 'rightShoulderInnerAngle', 'value' : rightShoulderInnerAngle },
    { 'name' : 'rightElbowAngle', 'value' : rightElbowAngle },
    { 'name' : 'leftShoulderAngle', 'value' : rleftShoulderAngle },
    { 'name' : 'leftShoulderInnerAngle', 'value' : leftShoulderInnerAngle },
    { 'name' : 'leftElbowAngle', 'value' : leftElbowAngle },
    { 'name' : 'rightHipAngle', 'value' : rightHipAngle },
    { 'name' : 'leftHipAngle', 'value' : leftHipAngle }
  ];

  return values;
}

function jointsAngle(a, b, c) {
  let mAB = (b.y - a.y) / (b.x - a.x);
  let mBC = (c.y - b.y) / (c.x - b.x);

  let angle = Math.atan2((mBC - mAB), (1 + mBC * mAB)) * 180 / Math.PI;

  if (angle < 0)
    angle = 180 + angle;

  return Math.round(angle);
}

function translatedJointAngle(a, o) {
  let x = a.x - o.x;
  let y = a.y - o.y;

  let angle = Math.atan2(y, x) * 180 / Math.PI;

  if (angle < 0)
    angle = 180 + angle;

  return Math.round(angle);
}

function calcTranslatedJointsAngles(pose) {
  let values = [];

  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    let adiacentIndex = adiacentKeypointsIndexes[j];
    let adiacentKeypoint = pose.keypoints[adiacentIndex];

    let t_angle = translatedJointAngle(keypoint.position, adiacentKeypoint.position);

    let value = {
      'part' : keypoint.part,
      'angle' : t_angle
    }

    values = values.concat(value);
  }

  return values;
}

function extractEstimatedValues(pose) {
  let values = [];

  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    
    let value = {
      'part' : keypoint.part,
      'x' : Math.round(keypoint.position.x),
      'y' : Math.round(keypoint.position.y)
    }
    values = values.concat(value);
  }

  return values;  
}

function detectPoses(video) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const estimatePoses = document.getElementById('estimatePoses');
  const showKeypoints = document.getElementById('showKeypoints');
  const showSkeleton = document.getElementById('showSkeleton');
  const collectPoses = document.getElementById('collectPoses');
  const target = document.getElementById('target');

  function drawVideo(ctx, video) {
    ctx.clearRect(0, 0, videoDim, videoDim);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-video.width, 0);
    ctx.drawImage(video, 0, 0, videoDim, videoDim);
    ctx.restore();
  }

  async function posesDetection() {
    let pose;
    let minPoseConfidence;
    let minPartConfidence;

    if (collectPoses.checked && (target.value.length == 0)) {
      collectPoses.checked = false;
      $('#collectPoses').prop('checked', false).change();
    }

    if (collectPoses.checked && !estimatePoses.checked) {
      collectPoses.checked = false;
      $('#collectPoses').prop('checked', false).change();
    }

    if (collecting && !collectPoses.checked)
      collecting = false;

    if (!collecting && collectPoses.checked && countdownEnabled) {
      drawVideo(ctx, video);
      window.requestAnimationFrame(posesDetection);
      return;
    }

    if (estimatePoses.checked) {
      pose = await net.estimateSinglePose(video, {
        flipHorizontal: 'true'
      });
    }

    drawVideo(ctx, video);

    if (estimatePoses.checked) {
      let f_pose = filterPose(pose);
      
	  showEstimatedValues(f_pose);

      if (collectPoses.checked) {
        if (collecting && target.value.length > 0)
          collect(f_pose, target.value);
        else {
          let warningTime = Number(document.getElementById('warningTime').value);
          
          if (isNaN(warningTime))
            warningTime = defaultWarningTime;

          if (!countdownEnabled ) {
            alertify.warning('Get ready!');
            bt_start("#countdown", warningTime, "");
            countdownEnabled = true;
          }

          setTimeout(setCollecting, warningTime*1000);
        }
      }

      if (showKeypoints.checked)
        drawKeypoints(f_pose, ctx);

      if (showSkeleton.checked)
        drawSkeleton(pose, ctx);
    }

    window.requestAnimationFrame(posesDetection);
  }

  posesDetection();
}

function clearMemory() {
  memory.length = 0;
  memoryCounters.length = 0;

  document.getElementById("countersDiv").style.display = 'none';
  document.getElementById("buttonsDiv").style.display = 'none';
  $("#countersTable").find("tbody").empty();
}

function populateKeypointsTable() {
  for (let i=0; i<keypointsParts.length; i++) {
    $('#keypointsTable').find('tbody').append("<tr><td>" + keypointsParts[i] + "</td><td id='td" + keypointsParts[i] + "'>-</td></tr>");
  }
}

function saveDataset() {
  if (memory.length == 0)
    return;

  let dataFileName = $("#dataFileName").val();

  if (dataFileName.length > 0) {
  	$("#dataFileName").removeClass('is-invalid');

	let t = [], outputs = [];
	for (let key in memoryCounters) {
		t.push({
		    "target": key,
		    "count": memoryCounters[key]
		});
		outputs.push(key);
	}

	let datafile = {
		"project": projectID,
		"network": {
		  "inputs": keypointsParts,
		  "outputs": outputs
		},
		"stats": {
		  "lines": memory.length,
		  "targets": t
		},
		"memory": memory,
		"name": dataFileName
	};

	let url;

	if (datafileID != null) {
		datafile.id = datafileID;
		url = '/services/updateDataFile';
	} else
		url = '/services/createDataFile';

	$.ajax({
	  url: url,
	  type: 'POST',
	  data: JSON.stringify(datafile),
	  contentType: 'application/json; charset=utf-8',
	  dataType: 'json',
	  async: true,
	  success: function(msg) {
	      alertify.success('Datafile saved', 2, () => { return; });
	  }
	});    
  } else
    $("#dataFileName").addClass('is-invalid');
}

async function main() {
  let video;

  // make alertify defaults bootstrap compliant
  //alertify.defaults.transition = "slide";
  alertify.defaults.theme.ok = "btn btn-primary";
  alertify.defaults.theme.cancel = "btn btn-danger";
  alertify.defaults.theme.input = "form-control";

  projectID = $.urlParam('project');
  datafileID = $.urlParam('datafile');

  if (projectID == null) {
    window.location.replace('/');
    return;
  }

  $("#countdown").dialog({ autoOpen: false, width: 340, modal: true });
  $("#warningTime").val("10");
  $("#collectTime").val("20");

  await loadJSON('/getPosenetConfig?id=' + projectID, function(text) {
    let netConfig = JSON.parse(text);

    (async() => {
      net = await posenet.load(netConfig);
    })().then(() => {
    });

  });

  try {
    video = await loadVideo();
  } catch (e) {
    console.log('this browser does not support video capture, or this device does not have a camera');
    throw e;
  }

  document.getElementById("saveDataset").onclick = function() { saveDataset() };
  document.getElementById("clearMemory").onclick = function() { alertify.confirm('You are going to clear all in-memory data','Are you sure?', function(){ clearMemory(); }, null); };
  document.getElementById("close").onclick = function() { window.location.replace('index.html?project=' + projectID); };

  if (datafileID != null) {
    loadJSON('/getDataFile?id=' + datafileID, function(text) {
    	let obj = JSON.parse(text);
    	memory = obj.memory;
    	$("#dataFileName").val(obj.name);
    	createAllCounters();
    });    
  }
  
  populateKeypointsTable();

  detectPoses(video);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

document.addEventListener("DOMContentLoaded", function() {
  main();
});
