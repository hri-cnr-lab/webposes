
var model, projectID, datasetID, modelID, datasetInfo, networkOptions, dataType, chart; //, inputs, labels;
var modelCompiled = false;
const videoDim = 514;

async function getData(url) {
  const poseDataReq = await fetch(url);
  const poseData = await poseDataReq.json();
  return poseData;
}

function extractRawData(data, outputs) {
  var xs = [];
  var ys = [];

  for (let record of data.data) {
    xs.push(Object.values(record.xs));
    ys.push(outputs.indexOf(record.ys.direction));
  }

  return {
    xs: xs,
    ys: ys
  };
}

// Fisher-Yates shuffle
function shuffle(array) {
  for (let i = array.xs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    // swap elements array[i] and array[j]
    // we use "destructuring assignment" syntax to achieve that
    // same can be written as:
    // let t = array[i]; array[i] = array[j]; array[j] = t
    [array.xs[i], array.xs[j]] = [array.xs[j], array.xs[i]];
    [array.ys[i], array.ys[j]] = [array.ys[j], array.ys[i]];
  }
}

function convertToTensor(data, inputs, labels) {
  const dataLength = data.xs.length;
  const maxVal = (dataType == 'Keypoints') ? videoDim : 180;

  return tf.tidy(() => {
    // Step 1. Shuffle the data
    shuffle(data);
    //console.log(data);

    const inputArr = [];

    data.xs.forEach(row => {
      // get xs
      const xs = Object.keys(inputs)
        .map(k => {
          return row[k] / maxVal; // normalize on the fly: video width = height = 514
        })
        .flat();

      inputArr.push(xs);
    });

    let lt = tf.tensor1d(data.ys, 'int32');

    const inputTensor = tf.tensor2d(inputArr);
    const labelTensor = tf.oneHot(lt, labels.length).cast('float32');

//    inputTensor.print();
//    labelTensor.print();

    return {
      inputs: inputTensor,
      labels: labelTensor
    };
  });
}

function saveModel() {
  let modelName = $("#modelName").val();

  if (modelName.length > 0) {
    $("#modelName").removeClass('is-invalid');

    const jmodel = {
      name: modelName,
      projectID: projectID,
      datasetID: datasetID,
      type: dataType,
      networkOptions: networkOptions,
    };

    if (modelID != null) {
      jmodel.id = modelID;
    } 

    $.ajax({
        url: '/services/saveModel',
        type: 'POST',
        data: JSON.stringify(jmodel),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: async function(msg) {
            if (msg.status == 'success') {
              modelID = msg.id;
              model.setUserDefinedMetadata({ projectID: projectID, modelID: modelID });
              await model.save(tf.io.http('/services/tfSaveModel'));
              alertify.success('Model saved', 2, () => { return; });
            }
        }
    });
  } else
    $("#modelName").addClass('is-invalid');
}


function whileTraining(epoch, loss) {
  chart.data.labels.push(epoch);
  chart.data.datasets[0].data.push(loss.loss);
  chart.update(0);
}

function doneTraining() {
  alertify.success('Model trained', 2, () => {
    document.getElementById("save").removeAttribute("disabled");
    isTrained = true;
  });
}

function validatedTrainForm() {
  let Nh1T = !isNaN($("#dimension1").val());
  let Nh2T = !isNaN($("#dimension2").val());
  let learningRateT = !isNaN($("#learningRate").val());
  let epochsT = !isNaN($("#epochs").val());
  let batchSizeT = !isNaN($("#batchSize").val());
  let validationSplitT = !isNaN($("#validationSplit").val());

  if (Nh1T)
    $("#dimension1").removeClass('is-invalid').addClass('is-valid');
  else
    $("#dimension1").removeClass('is-valid').addClass('is-invalid');

  if ($('#secondlayer').is(":checked")) {
    if (Nh2T)
      $("#dimension2").removeClass('is-invalid').addClass('is-valid');
    else
      $("#dimension2").removeClass('is-valid').addClass('is-invalid');
  }

  if (learningRateT)
    $("#learningRate").removeClass('is-invalid').addClass('is-valid');
  else
    $("#learningRate").removeClass('is-valid').addClass('is-invalid');

  if (epochsT)
    $("#epochs").removeClass('is-invalid').addClass('is-valid');
  else
    $("#epochs").removeClass('is-valid').addClass('is-invalid');

  if (batchSizeT)
    $("#batchSize").removeClass('is-invalid').addClass('is-valid');
  else
    $("#batchSize").removeClass('is-valid').addClass('is-invalid');

  if (validationSplitT)
    $("#validationSplit").removeClass('is-invalid').addClass('is-valid');
  else
    $("#validationSplit").removeClass('is-valid').addClass('is-invalid');

  return Nh1T && Nh2T && learningRateT && epochsT && batchSizeT && validationSplitT;
}

function makeChart() {
  let ctx = document.getElementById('canvas').getContext('2d');
  
  let chartConfig = {
    type: 'line',
    data: {
      datasets: [
        {
          backgroundColor: 'rgb(255, 99, 132)',
          borderColor: 'rgb(255, 99, 132)',
          data: [],
          fill: false
        }
      ]
    },
    options: {
      legend: {
        display: false
      },
      responsive: true,
      title: {
        display: true,
        text: 'Training Performance'
      },
      tooltips: {
        mode: 'index',
        intersect: false
      },
      hover: {
        mode: 'nearest',
        intersect: true
      },
      scales: {
        xAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'epoch'
          }
        }],
        yAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'loss'
          }
        }]
      }
    }
  };

  const c = new Chart(ctx, chartConfig);
  return c;
}


async function train(model, inputs, labels) {
  chart.destroy();
  chart = makeChart();

  let trainingOptions = {
    shuffle: true,
    epochs: Number($("#epochs").val()),
    batchSize: Number($("#batchSize").val()),
    validationSplit: Number($("#validationSplit").val()),
    callbacks: {
      onEpochEnd: (epoch, logs) => { 
        whileTraining(epoch, logs);
      },
      onBatchEnd: async (batch, logs) => {
        await tf.nextFrame();
      },
      onTrainEnd: () => {
        doneTraining();
      }
    }
  };

  //console.log(inputs, labels, trainingOptions);

  await model.fit(inputs, labels, trainingOptions);
}

function createModel(Ni, No, twoHiddenLayers) {
  const LEARNING_RATE = Number($("#learningRate").val());
  const optimizers = [
    tf.train.sgd(LEARNING_RATE), 
    tf.train.adagrad(LEARNING_RATE),
    tf.train.adadelta(LEARNING_RATE),
    tf.train.adam(LEARNING_RATE),
    tf.train.adamax(LEARNING_RATE),
    tf.train.rmsprop(LEARNING_RATE)
  ];

  const model = tf.sequential();

  model.add(tf.layers.dense({ units: Number($("#dimension1").val()), inputShape: [ Ni ], activation: $("#activation1 option:selected").text() }));

  if (twoHiddenLayers) {
    model.add(tf.layers.dense({ units: Number($("#dimension2").val()), activation: $("#activation2 option:selected").text() }));
  }

  model.add(tf.layers.dense({ units: No, activation: $("#activationOut option:selected").text() }));

  model.compile({
    loss: $("#loss option:selected").text(),
    optimizer: optimizers[$("#optimizer option:selected").val()],
    metrics: ['accuracy']
  });

  modelCompiled = true;

  return model;
}

async function main() {
  projectID = $.urlParam('project');
  datasetID = $.urlParam('dataset');
  modelID = null;

  if ((projectID == null) || (datasetID == null)) {
    let url = projectID ? 'index.html?project=' + projectID : '/';
    window.location.replace(url);
    return;
  }

  chart = makeChart();

  const data = await getData('/services/getDataSet?id=' + datasetID);
  dataSetInfo = await getData('/services/getDataSetInfo?id=' + datasetID); 

  dataType = dataSetInfo.type;

  networkOptions = {
    task: 'classification',
    inputs: dataSetInfo.network.inputs,
    outputs: dataSetInfo.network.outputs
  };

  const dataRaw = extractRawData(data, dataSetInfo.network.outputs);

  // Convert the data to a form we can use for training.
  const tensorData = convertToTensor(dataRaw, dataSetInfo.network.inputs, dataSetInfo.network.outputs);
  //console.log(tensorData);

  const { inputs, labels } = tensorData;
//  this.inputs = inputs;
//  this.labels = labels;

  let Ni = dataSetInfo.network.inputs.length;
  let No = dataSetInfo.network.outputs.length;
  let Nh1 = (Ni*2 + No);
  let Nh2 = Math.round((Nh1 + No) / 2);

  $("#dsName").html("dataset: <b>" + dataSetInfo.name + "</b>");
  $("#dsType").html("type: <b>" + dataType + "</b>");
  $("#dsIO").html("inputs: <b>" + Ni + "</b>, outputs: <b>" + No + "</b>");

  $('#dimensionIn').val(Ni);
  $('#dimension1').val(Nh1);
  $('#dimension2').val(Nh2);
  $('#dimensionOut').val(No);

  document.getElementById("train").onclick = function() { 
    if (validatedTrainForm()) {
      let twoHiddenLayers = $('#secondlayer').is(":checked");

      if (modelCompiled) {
        tf.dispose(model);
        modelCompiled = false;
      }

      model = createModel(Ni, No, twoHiddenLayers);
      model.summary();

      train(model, inputs, labels);
    }
  }

  document.getElementById("secondlayer").onclick = function() {
    let twoHiddenLayers = $('#secondlayer').is(":checked");

    $('#dimension2').prop("disabled", !twoHiddenLayers);
    $('#activation2').prop("disabled", !twoHiddenLayers);
  }

  document.getElementById("close").onclick = function() { window.location.replace('index.html?project=' + projectID); };
}

document.addEventListener("DOMContentLoaded", function() {
  main();
});