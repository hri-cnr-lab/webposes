
var net, brain, projectID, networkID, dataType, model, inputs, labels, s2t, SpeechRecognition, recognition, utter;
var soundstart = null;
var soundend = null;
var autostart = true;
var recognitionActive = false;
var detectedPoses = [];
var synth = window.speechSynthesis;

var meter = null;
var volume = 0;

const videoDim = 514;
const keypointsParts = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip'];

const adiacentKeypointsIndexes = [  6, // 'leftHip', 
                                    0, // 'leftShoulder'
                                    0, // 'leftShoulder'
                                    1, // 'rightShoulder'
                                    2, // 'leftElbow'
                                    3, // 'rightElbow'
                                    7, // 'rightHip'
                                    1  // 'rightShoulder'
];

function selectedObject(pose) {
  switch (pose) {
    case 'UpSx':
      return('La donna con l\'ermellino');
    case '_UpSx':
      return('La donna con l\'ermellino');
    case 'UpDx':
      return('Autoritratto di Leonardo');
    case '_UpDx':
      return('Autoritratto di Leonardo')
    case 'DwnDx':
      return('La gioconda');
    case '_DwnDx':
      return('La gioconda');
    case 'DwnSx':
      return('La vergine delle rocce');
    case '_DwnSx':
      return('La vergine delle rocce');
    default:
      return('Oggetto sconosciutos');
  }
} 

function setOutput(){
  document.getElementById('activityL').innerHTML = roundToTwo(activeArmConfidenceL);
  document.getElementById('activityR').innerHTML = roundToTwo(activeArmConfidenceR);
}

function clearOutput(){
  document.getElementById('activityL').innerHTML = "-";
  document.getElementById('activityR').innerHTML = "-";
}

function roundToTwo(num) {    
  return +(Math.round(num + "e+2")  + "e-2");
}

function poseAnalisys(res) {
  var activeArm;
  var activeArmConfidenceR;
  var activeArmConfidenceL;       

  var x = new Array();
  var poseLabel = new Array();
  var count = new Array();
  var velocityL = new Array();
  var accL = new Array();
  var velocityR = new Array();
  var accR = new Array();
  var EcL;
  var EcR;
  var duration;
  var rle = new Array();
  var j,k;

  velocityL[0] = 0;
  accL[0] = 0;
  velocityR[0] = 0;
  accR[0] = 0;
  EcL=0;
  EcR=0;
  j=0; k=0;
  
  duration = res.poses[res.poses.length - 1].moment-res.poses[0].moment;

  for (var i = 0 ; i <= res.poses.length - 1; i++) {

    poseLabel[i]=res.poses[i].label;

    if (i>0) {
      let x2l=res.poses[i].leftWrist.position.x;
      let y2l=res.poses[i].leftWrist.position.y;
      let x1l=res.poses[i-1].leftWrist.position.x;
      let y1l=res.poses[i-1].leftWrist.position.y;
      let x2r=res.poses[i].rightWrist.position.x;
      let y2r=res.poses[i].rightWrist.position.x;
      let x1r=res.poses[i-1].rightWrist.position.x;
      let y1r=res.poses[i-1].rightWrist.position.x;

      let Dt=res.poses[i].moment-res.poses[i-1].moment;

      velocityL[i]=Math.sqrt(Math.pow((x2l-x1l),2)+Math.pow((y2l-y1l),2))/Dt;
      velocityR[i]=Math.sqrt(Math.pow((x2r-x1r),2)+Math.pow((y2r-y1r),2))/Dt;

      accL[i]=(velocityL[i]-velocityL[i-1])/Dt;
      accR[i]=(velocityR[i]-velocityR[i-1])/Dt;

      /*Energia cinetica supponendo corpo di massa 2 -> Ec=1/2*m*V^2 */
      EcL=EcL+Math.pow(velocityL[i],2);
      EcR=EcR+Math.pow(velocityR[i],2);

      if (poseLabel[i]==poseLabel[i-1] && poseLabel[i]!=labels[0]) {
        k++;
        rle[j-1]={'numbers': k, 'pose': poseLabel[i], 'start': i-k+1, 'end': i};
      }
      else if (poseLabel[i]!=labels[0]) {
        j++;
        k=0;
      }
    }
  }

  if (rle.length>0) {
      /* trova il braccio più attivo */
      activeArmConfidenceR = EcR/(EcL+EcR);
      activeArmConfidenceL = EcL/(EcL+EcR);

      activeArm = (EcL>EcR) ? "left" : "right";

      /* trova posa migliore */
      var x = rle.map(function(row) {
        return row.numbers;
      }).sort((a, b) => b - a);
      
      const toFind = (element) => element == x[0];

      let index =rle.map(function(row) {
          return row.numbers;
      }).findIndex(toFind);

      var bestPose= rle[index].pose;
      var start = rle[index].start;
      var end = rle[index].end;
    
      /* trova il frammento di frase a cui è riferita la posa */
      let sStr=Math.trunc((res.poses[start].moment/duration)*res.speech.length);
      let eStr=Math.trunc((res.poses[end].moment/duration)*res.speech.length);
      
      console.log(res.speech.length,sStr,eStr);
      console.log(res.speech.substr(sStr,eStr));

      document.getElementById('activityL').innerHTML = roundToTwo(activeArmConfidenceL);
      document.getElementById('activityR').innerHTML = roundToTwo(activeArmConfidenceR);
      document.getElementById('activeArmL').innerHTML = ((activeArmConfidenceL > activeArmConfidenceR) ? 'YES' : 'NO')
      document.getElementById('activeArmR').innerHTML = ((activeArmConfidenceL < activeArmConfidenceR) ? 'YES' : 'NO')

      document.getElementById('objectL').innerHTML = ((activeArmConfidenceL > activeArmConfidenceR) ? selectedObject(bestPose) : 'NONE')
      document.getElementById('objectR').innerHTML = ((activeArmConfidenceL < activeArmConfidenceR) ? selectedObject(bestPose) : 'NONE')
      document.getElementById('groundingL').innerHTML = ((activeArmConfidenceL > activeArmConfidenceR) ? res.speech.substr(sStr,eStr) : 'NONE')
      document.getElementById('groundingR').innerHTML = ((activeArmConfidenceL < activeArmConfidenceR) ? res.speech.substr(sStr,eStr) : 'NONE')
  } 
  return selectedObject(bestPose);
}

async function setupMicrophone() {
  navigator.getUserMedia({
    "audio": {
      "mandatory": {
        "googEchoCancellation": "false",
        "googAutoGainControl": "false",
        "googNoiseSuppression": "false",
        "googHighpassFilter": "false"
      },
      "optional": []
    },
  }, gotStream, didntGetStream);
}

function didntGetStream() {
    alert('Stream generation failed.');
}

async function gotStream(stream) {
  let audioCtx = new AudioContext();
  let microphone = audioCtx.createMediaStreamSource(stream);
  
  await audioCtx.resume();
  await audioCtx.audioWorklet.addModule('/js/vumeter.js');
  
  const node = new AudioWorkletNode(audioCtx, 'vumeter');

  node.port.onmessage = event => {
    volume = 0
    if (event.data.volume) {
      volume = event.data.volume * 100;
      if (volume < 1)
        volume = 0;
      else
        console.log(volume)      
    }
  };

  microphone.connect(node).connect(audioCtx.destination);
}

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
  const ctx = document.getElementById('canvas').getContext('2d');
  const meterCtx = document.getElementById('meter').getContext("2d");

  const meterWIDTH =  document.getElementById('s2t').offsetWidth;
  const meterHEIGHT = document.getElementById('meter').height;

  meterCtx.canvas.width = meterWIDTH;
  meterCtx.shadowBlur = 5;

  const barCount = 15;
  const barGap = 0.01 * meterWIDTH;

  const getBoxColor = (i, vol) => {
    let h = 99;
    if (i > barCount * 0.65)
      h = 48;

    if (i > barCount * 0.8)
      h = 0;

    let l = 13;
    if ((i / barCount)*100 < vol)
      l = 50;

    return `hsl(${h}, 70%, ${l}%)`;
  };

  async function posesDetection() {

    meterCtx.clearRect(0,0,meterWIDTH,meterHEIGHT);

    for (let i=0; i<barCount; i++) {
      meterCtx.beginPath();
      meterCtx.shadowColor = meterCtx.fillStyle = getBoxColor(i, volume);

      let width = meterWIDTH/(barCount+1) - barGap;
      meterCtx.rect(barGap*(i+1) + i*width, meterHEIGHT*0.1, width, meterHEIGHT*0.8);

      meterCtx.fill();    
    }

    let spose = 0;//await net.estimateSinglePose(video, { flipHorizontal: 'true' });

      ctx.clearRect(0, 0, videoDim, videoDim);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-video.width, 0);
      ctx.drawImage(video, 0, 0, videoDim, videoDim);
      ctx.restore();

    if (spose) {
      let pose = filterPose(spose);


      drawKeypoints(pose, ctx);
      drawSkeleton(spose, ctx);

      if (pose.score > 0.70) {
        let inputs = makeInputs(pose);
        classify(inputs, spose.keypoints[9], spose.keypoints[10]);
      }
    }

    window.requestAnimationFrame(posesDetection);
  }

  posesDetection();
}


function classify(input, leftWrist, rightWrist) {
  const maxVal = (dataType == 'Keypoints') ? videoDim : 180;
  const normalizedInput = input.map(x => {
    return x / maxVal;
  });

  return tf.tidy(() => {

    const inputTensor = tf.tensor2d([normalizedInput]);

    let results = model.predict(inputTensor);
    let argMax = results.argMax(1);
    let index = argMax.dataSync()[0];
    let confidence = results.dataSync()[index];

    let score = (confidence > 0.70) ? Math.round(confidence * 10000) / 100 : '';
    let label = (confidence > 0.70) ? labels[index] : '';

    if ((label != '') && recognitionActive) {     
      let now = new Date();
      let moment = now.getTime() - soundstart.getTime();

      let poseX = {
        label: label,
        score: score,
        moment: moment,
        leftWrist: leftWrist,
        rightWrist: rightWrist
      };

      detectedPoses.push(poseX);
    }

    document.getElementById('target').innerHTML = label;
    document.getElementById('score').innerHTML = score;

    return label;
  });
}

async function getData(url) {
  const req = await fetch(url);
  const reqData = await req.json();
  return reqData;
}

$.urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null) {
       return null;
    }
    return decodeURI(results[1]) || 0;
}

async function askAgent (query) {
  let service = 'https://nlpit.na.icar.cnr.it/KGPyramidAssistant/query';
  let args = '?inputText=' + encodeURI(query) + '&userProfile=adult&username=Paziente';
  let url = service + args;

  let data = await getData(url);
  let answer = data.mResult;

  console.log(answer);

  showImg("Talking");

  utter.text = answer;
  synth.speak(utter);
}

function recognitionResults() {
  let duration = soundend.getTime() - soundstart.getTime();

  let res = {
    speech: s2t,
    poses: detectedPoses,
    duration: duration
  };

  if (res.poses.length>0)
    poseAnalisys(res);

  console.log(res);

  askAgent(s2t + poseAnalisys(res)); // ask to conversational agent
}

function showImg(img) {
  document.getElementById('Searching4Person').style.display = 'none';
  document.getElementById('Recording').style.display = 'none';
  document.getElementById('Eng2Know').style.display = 'none';
  document.getElementById('Searching4Person').style.display = 'none';
  document.getElementById('Talking').style.display = 'none';
  document.getElementById('Thinking').style.display = 'none';
  document.getElementById('Waiting4Gaze').style.display = 'none';

  document.getElementById(img).style.display = 'block';
}

async function main() {
  projectID = $.urlParam('project');
  networkID = $.urlParam('network');

  //projectID = 'x000';
  //networkID = 'cb224680-015a-4a87-9065-a0e919a746a0';

  if ((projectID == null) || (networkID == null)) {
    window.location.replace('/');
    return;
  }

  try {
    SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    utter = new SpeechSynthesisUtterance();
  }
  catch(e) {
    console.error(e);
    return;
  }

  utter.lang = 'it-IT';

  utter.onend = function() {
    recognition.start();
  }

  recognition.continuous = false;
  recognition.lang = 'it-IT';

  recognition.onstart = function() { 
    showImg("Eng2Know");

    detectedPoses = [];
    s2t = '';

    console.log('[ONSTART] Voice recognition activated. Try speaking into the microphone.');
  }

  // l'evento onend coincide con onsoundend nella modalità non continua
  recognition.onend = function() {
    showImg("Thinking");

    recognitionActive = false;
    soundend = new Date();

    console.log('[ONEND] Voice recognition deactivated. ' + soundend.getTime());

    if (s2t != '') 
      recognitionResults();
    else if (autostart)
      setTimeout(recognition.start(), 3000);
  }

  recognition.onsoundstart = function() {
    showImg("Recording");

    soundstart = new Date();
    recognitionActive = true;

    console.log('[SOUNDSTART] some sound, possibly speech, has been detected ' + soundstart.getTime());
  }

  recognition.onresult = function(event) {
    var current = event.resultIndex;
    s2t = event.results[current][0].transcript;
    var mobileRepeatBug = (current == 1 && s2t == event.results[0][0].transcript);

    if(!mobileRepeatBug) {
       let now = new Date();

      $('#s2t').append('[' + now.toLocaleTimeString() + '] ' + s2t + '<br>');
      $('#s2t').scrollTop($('#s2t')[0].scrollHeight);
    }
  };

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    console.log('this browser does not support video capture, or this device does not have a camera');
    return;
  }

  $('#start-recognition').on('click', function(e) { autostart = true; recognition.start(); });
  $('#stop-recognition').on('click', function(e) { autostart = false; recognition.stop(); });

  const posenetOptions = await getData('/models/' + projectID + '.json');

  net = await posenet.load(posenetOptions);

  const networkInfo = await getData('/models/' + networkID + '.json');

  dataType = networkInfo.type;

  inputs = networkInfo.options.inputs;
  labels = networkInfo.options.outputs;

  model = await tf.loadLayersModel('/models/' + projectID + '/' + networkID + '.json');
  model.summary();

  setupMicrophone();

  detectPoses(video);
}

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
window.AudioContext = window.AudioContext || window.webkitAudioContext;

document.addEventListener("DOMContentLoaded", function() {
  main();
});
