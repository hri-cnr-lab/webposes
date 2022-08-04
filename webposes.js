#!/usr/bin/env node

var low = require('lowdb'),
    FileAsync = require('lowdb/adapters/FileAsync'),
    lodashId = require('lodash-id'),
    shortid = require('shortid'),
    path = require('path'),
    fs = require('fs-extra');

const keypointsParts = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip'];
const jointsAngles = ['leftShoulderAngle', 'leftShoulderInnerAngle', 'rightShoulderAngle', 'rightShoulderInnerAngle', 'leftElbowAngle', 'rightElbowAngle', 'leftHipAngle', 'rightHipAngle'];
const adiacentKeypointsIndexes = [  6, // 'leftHip', 
                                    0, // 'leftShoulder'
                                    0, // 'leftShoulder'
                                    1, // 'rightShoulder'
                                    2, // 'leftElbow'
                                    3, // 'rightElbow'
                                    7, // 'rightHip'
                                    1  //'rightShoulder'
];

const fastify = require('fastify')({ logger: true, bodyLimit: 104857600 });
const fstatic = require('fastify-static');
const {spawn} = require('child_process');

const adapter = new FileAsync('projects.json');

var projects;
var db;

// tensorflowjs_converter --input_format tfjs_layers_model --output_format keras www/models/x000/cb224680-015a-4a87-9065-a0e919a746a0.json www/models/x000/cb224680-015a-4a87-9065-a0e919a746a0.h5
fastify.post('/exportNetwork', (request, reply) => {
    let obj = request.body;

    let projectID = obj.project
    let networkID = obj.network;

        let networkPath = path.join(__dirname, 'www', 'models', projectID, networkID);
        var stderr = '';

        const python = spawn('tensorflowjs_converter', ['--input_format','tfjs_layers_model','--output_format','keras', networkPath + '.json', networkPath + '.h5']);

        python.stderr.on('data', function (data) {
            stderr = data.toString();
        });

        python.on('close', (code) => {
            // send exit code to browser and log output
            console.log(stderr);
            reply.send({ status: code });
        });
});

fastify.post('/removeNetwork', (request, reply) => {
    let obj = request.body;

    let projectID = obj.project
    let networkID = obj.network;

    (async() => {
        let networkPath = path.join(__dirname, 'www', 'models', projectID);

        await db.get('networks').remove({ id: networkID }).write();
        await fs.remove(networkPath + '/' + networkID + '.json');
        await fs.remove(networkPath + '/' + networkID + '.weights.bin');
    })().then(() => {
        reply.send({ status: 'success' });
    });
});


fastify.post('/tfSaveModel', async function (request, reply){
    const parts = await request.saveRequestFiles();
    //console.log(parts[0]);
    //console.log(parts[1]);

    fs.readFile(parts[0].filepath, 'utf8', function (err, data) {
        if (err) throw err;

        let model = JSON.parse(data);
        let projectID = model.userDefinedMetadata.projectID;
        let modelID = model.userDefinedMetadata.modelID;

        model.weightsManifest[0].paths = [ "./" + modelID + ".weights.bin" ];

        //console.log(model);

        let networkFileDir = path.join(__dirname, 'www', 'models', projectID);

        let manifestFilePath = path.join(networkFileDir, modelID + '.json');
        fs.writeFileSync(manifestFilePath, JSON.stringify(model), 'utf8');

        let weightsFilePath = path.join(networkFileDir, modelID + '.weights.bin');

        fs.copyFile(parts[1].filepath, weightsFilePath);

        reply.send({ status: 'success' });
    });
});

fastify.post('/saveModel', (request, reply) => {
    let network = {
        project: request.body.projectID,
        dataset: request.body.datasetID,
        name: request.body.name,
        type: request.body.type,
        options: request.body.networkOptions
    }

    let ts = new Date();
    network.lastModified = ts.toJSON();

    if (!request.body.id)
        network.creationDate = network.lastModified;
    else
        network.id = request.body.id;

    let weights = request.body.weights;
    let manifest = request.body.manifest;
    let meta = request.body.meta;

    (async() => {
        if (!request.body.id)
            network = await db.get('networks').insert(network).write();
        else        
            await db.get('networks').find({ id: network.id }).set('lastModified', network.lastModified).set('name', network.name).write();
    })().then(() => {

        reply.send({ status: 'success', id: network.id })

    });
});


fastify.get('/getNetworkInfo', (request, reply) => {
    let id = request.query.id;

    let network = db.get('networks')
        .find({ id: id })
        .value();

    reply.send(network);
});

fastify.get('/getDataSetInfo', (request, reply) => {
    let id = request.query.id;

    let dataset = db.get('datasets')
        .find({ id: id })
        .value();

    reply.send(dataset);
});

fastify.get('/getDataSet', (request, reply) => {
    let id = request.query.id;

    let dataset = db.get('datasets')
        .find({ id: id })
        .value();

    let dataSetPath = path.join(__dirname, 'projects', dataset.project, 'datasets', id + '.json');

    fs.readFile(dataSetPath, 'utf8', function (err, data) {
        if (err) throw err;
        let obj = JSON.parse(data);
        
        reply.send(obj);
    });
});

fastify.get('/getDataFile', (request, reply) => {
    let id = request.query.id;

    let datafile = db.get('datafiles')
        .find({ id: id })
        .value();

    let dataFilePath = path.join(__dirname, 'projects', datafile.project, 'datafiles', id + '.json');

    fs.readFile(dataFilePath, 'utf8', function (err, data) {
        if (err) throw err;

        let obj = {
            name: datafile.name,
            memory: JSON.parse(data)
        };
        
        reply.header('Pragma', 'no-cache').header('Cache-Control', 'no-cache').send(obj);
    });
});

fastify.get('/cloneProject', (request, reply) => {
    let ts = new Date();
    let id = request.query.id;

    let p = db.get('projects')
        .find({ id: id })
        .value();

    let project = Object.assign({}, p);

    delete project.id;
    project.name = 'Clone of ' + project.name;

    project.creationDate = project.lastModified = ts.toJSON();

    (async() => {
        project = await db.get('projects').insert(project).write();
    })().then(() => {
        fs.mkdirSync(path.join(__dirname, 'projects', project.id));
        fs.mkdirSync(path.join(__dirname, 'projects', project.id, 'datafiles'));
        fs.mkdirSync(path.join(__dirname, 'projects', project.id, 'datasets'));
        fs.mkdirSync(path.join(__dirname, 'www', 'models', project.id));

        reply.send({ status: 'success' })
    });    
});

fastify.get('/deleteProject', (request, reply) => {
    let id = request.query.id;

    (async() => {
        await db.get('projects').remove({ id: id }).write();
        await db.get('datafiles').remove({ project: id }).write();
        await db.get('datasets').remove({ project: id }).write();
        await db.get('networks').remove({ project: id }).write();
        await fs.remove(path.join(__dirname, 'projects', id));
        await fs.remove(path.join(__dirname, 'www', 'models', id));
    })().then(() => {
        reply.send({ status: 'success' });
    });

});

fastify.get('/getPosenetConfig', (request, reply) => {
    let id = request.query.id;
    let config = {};

    let project = db.get('projects')
        .find({ id: id })
        .value();

    if (project !== undefined) {
        config = Object.assign({}, project);

        delete config.id;
        delete config.name;
        delete config.createdBy;
        delete config.creationDate;
        delete config.lastModified;
    }

    reply.send(config);
});

fastify.post('/removeDataFiles', (request, reply) => {
    let obj = request.body;

    let projectID = obj.project
    let datafiles = obj.datafiles;

    (async() => {
        for (i=0; i<datafiles.length; i++) {
            let id = datafiles[i];
            let dataFilePath = path.join(__dirname, 'projects', projectID, 'datafiles', id + '.json');

            await db.get('datafiles').remove({ id: id }).write();
            await fs.remove(dataFilePath);
        }
    })().then(() => {
        reply.send({ status: 'success' });
    });
});

fastify.post('/removeDataSets', (request, reply) => {
    let obj = request.body;

    let projectID = obj.project
    let datasets = obj.datasets;

    (async() => {
        for (i=0; i<datasets.length; i++) {
            let id = datasets[i];
            let dataSetPath = path.join(__dirname, 'projects', projectID, 'datasets', id + '.json');

            await db.get('datasets').remove({ id: id }).write();
            await fs.remove(dataSetPath);
        }
    })().then(() => {
        reply.send({ status: 'success' });
    });
});

function round(n) {
  return Math.round( n * 100 + Number.EPSILON ) / 100;
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

  let xs = {
    'rightShoulderAngle' : round(rightShoulderAngle),
    'rightShoulderInnerAngle' : round(rightShoulderInnerAngle),
    'rightElbowAngle' : round(rightElbowAngle),
    'leftShoulderAngle' : round(leftShoulderAngle),
    'leftShoulderInnerAngle' : round(leftShoulderInnerAngle),
    'leftElbowAngle' : round(leftElbowAngle),
    'rightHipAngle' : round(rightHipAngle),
    'leftHipAngle' : round(leftHipAngle)
  };

  return xs;
}

function jointsAngle(a, b, c) {
  let mAB = (b.y - a.y) / (b.x - a.x);
  let mBC = (c.y - b.y) / (c.x - b.x);

  let angle = Math.atan2((mBC - mAB), (1 + mBC * mAB)) * 180 / Math.PI;

  if (angle < 0)
    angle = 180 + angle;

  return angle;
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
  let xs = {};

  for (let j = 0; j < pose.keypoints.length; j++) {
    let keypoint = pose.keypoints[j];
    let adiacentIndex = adiacentKeypointsIndexes[j];
    let adiacentKeypoint = pose.keypoints[adiacentIndex];

    let t_angle = translatedJointAngle(keypoint.position, adiacentKeypoint.position);

    xs[keypoint.part] = round(t_angle);
  }

  return xs;
}

function makeXSEntry(type, pose) {
    let xs = {};
    switch (type) {
        case 'Keypoints':
            let keypoints = pose.keypoints;
            for (let j = 0; j < keypoints.length; j++) {
                let keypoint = keypoints[j];
                xs[keypoint.part + '_x'] = keypoint.position.x;
                xs[keypoint.part + '_y'] = keypoint.position.y;
            }
            break;

        case '3-joints angles':
            xs = calc3jointsAngles(pose);
            break;

        case 'T-joints angles':
            xs = calcTranslatedJointsAngles(pose);
    }

    return xs;
}

fastify.post('/renameDataSet', (request, reply) => {
    let obj = request.body;

    let id = obj.id;
    let name = obj.name;

    (async() => {
        await db.get('datasets').find({ id: id }).set('name', name).write();
    })().then(() => {
        reply.send({ status: 'success' })
    });
});

fastify.post('/createDataSet', (request, reply) => {
    let obj = request.body;

    let projectID = obj.project
    let datafiles = obj.datafiles;
    let type = obj.type;
    let scoreThreshold = obj.scoreThreshold;
    let name = obj.name;

    let ds = [];
    let lines = 0;
    let targets = [];

    for (i=0; i<datafiles.length; i++) {
        let id = datafiles[i];

        let datafile = db.get('datafiles')
            .find({ id: id })
            .value();

        let dataFilePath = path.join(__dirname, 'projects', datafile.project, 'datafiles', id + '.json');

        let data = fs.readFileSync(dataFilePath, 'utf8');
        data = JSON.parse(data);

        data.forEach(function(dfline) {
            if (scoreThreshold < dfline.pose.score) {
                let ys = { "direction" : dfline.target };
                let xs = makeXSEntry(type, dfline.pose);


                let datasetEntry = { "xs": xs , "ys": ys };
                //console.log(datasetEntry);

                ds.push(datasetEntry);

                lines++;
                targets[dfline.target] = targets[dfline.target] ? targets[dfline.target]+1 : 1;                
            }
        });
    }

    let brain_ds = { "data" : ds };
    let data = JSON.stringify(brain_ds);

    let dataset = {};

    dataset.project = projectID;
    dataset.type = type;
    dataset.name = name;
    dataset.description = 'Built from: ' + JSON.stringify(datafiles);

    let t = [];
    let outputs = [];
    for (let key in targets) {
        t.push({
            "target": key,
            "count": targets[key]
        });
        outputs.push(key);
    }

    dataset.stats = {
        "lines": lines,
        "targets": t
    };

    let inputs = [];
    switch (type) {
        case '3-joints angles':
            inputs = jointsAngles;
            break;
        case 'Keypoints':
            for (let key in keypointsParts) {
                inputs.push(keypointsParts[key] + '_x');
                inputs.push(keypointsParts[key] + '_y');
            }
            break;
        default:
            inputs = keypointsParts;
    }

    dataset.network = {
        "inputs": inputs,
        "outputs": outputs
    };

    let ts = new Date();
    dataset.creationDate = ts.toJSON();

    (async() => {
        dataset = await db.get('datasets').insert(dataset).write();

    })().then(() => {
        let datasetPath = path.join(__dirname, 'projects', projectID, 'datasets', dataset.id + '.json');
        
        fs.writeFileSync(datasetPath, data, 'utf8');

        reply.send({ status: 'success' })
    });    
});

fastify.post('/updateDataFile', (request, reply) => {
    let ts = new Date();
    let datafile = request.body;
    let datafileID = datafile.id;
    let name = datafile.name;
    let lastModified = ts.toJSON();

    let memory = datafile.memory;

    (async() => {
        await db.get('datafiles').find({ id: datafile.id }).set('name', name).set('lastModified', lastModified).set('stats', datafile.stats).write();
    })().then(() => {
        let datafilePath = path.join(__dirname, 'projects', datafile.project, 'datafiles', datafile.id + '.json');        
        let data = JSON.stringify(memory);

        fs.writeFileSync(datafilePath, data, 'utf8');

        reply.send({ status: 'success' })
    });

});

fastify.post('/createDataFile', (request, reply) => {
    let ts = new Date();

    let datafile = Object.assign({}, request.body);

    datafile.creationDate = datafile.lastModified = ts.toJSON();

    let memory = Object.assign([], datafile.memory);
    delete datafile.memory;

    (async() => {
        datafile = await db.get('datafiles').insert(datafile).write();

    })().then(() => {
        let datafilePath = path.join(__dirname, 'projects', datafile.project, 'datafiles', datafile.id + '.json');        
        let data = JSON.stringify(memory);

        fs.writeFileSync(datafilePath, data, 'utf8');

        reply.send({ status: 'success' })
    });
});

fastify.post('/createProject', (request, reply) => {
    let ts = new Date();

    let project = Object.assign({}, request.body);

    project.creationDate = project.lastModified = ts.toJSON();

    (async() => {
        project = await db.get('projects').insert(project).write();

    })().then(() => {
        fs.mkdirSync(path.join(__dirname, 'projects', project.id));
        fs.mkdirSync(path.join(__dirname, 'projects', project.id, 'datafiles'));
        fs.mkdirSync(path.join(__dirname, 'projects', project.id, 'datasets'));
        fs.mkdirSync(path.join(__dirname, 'www', 'models', project.id));

        reply.send({ status: 'success' })
    });    
});

fastify.get('/getAllData', (request, reply) => {
    let projects = db.get('projects').value();
    let datafiles = db.get('datafiles').value();
    let datasets = db.get('datasets').value();
    let networks = db.get('networks').value();

    let allData = {
        projects: projects,
        datafiles: datafiles,
        datasets: datasets,
        networks: networks
    }

    reply.send(allData);
});

fastify.get('/getProjects', (request, reply) => {
    let list = db.get('projects').value();

    reply.send(list);
});

fastify.get('/getDataFilesList', (request, reply) => {
    let id = request.query.id;
    let data = [];

    let datafiles = db.get('datafiles')
        .filter({ project: id })
        .value();

    if (datafiles !== undefined)
        data = datafiles instanceof Array ? datafiles : [ datafiles ];

    reply.send(data);
});

fastify.get('/getDataSetsList', (request, reply) => {
    let id = request.query.id;
    let data = [];

    let datasets = db.get('datasets')
        .filter({ project: id })
        .value();

    if (datasets !== undefined)
        data = datasets instanceof Array ? datasets : [ datasets ];

    reply.send(data);
});

fastify.get('/getNetworksList', (request, reply) => {
    let id = request.query.id;
    let data = [];

    let networks = db.get('networks')
        .filter({ project: id })
        .value();

    if (networks !== undefined)
        data = networks instanceof Array ? networks : [ networks ];

    reply.send(data);
});


async function validate (username, password, req, reply) {
    if (username != 'webposes' || password != 'webposes') {
        return new Error('Unauthorized');
    }
}

(async() => {
    db = await low(adapter);
    db._.mixin(lodashId);
    await db.defaults({ projects: [], datafiles: [], datasets: [], networks: [] }).write();
})().then(
    () => {
        fastify
            .register(require('fastify-auth'))
            .register(require('fastify-basic-auth'), { validate, authenticate: true })
            .register(require('fastify-multipart'), { attachFieldsToBody: false })
            .after(() => {
                fastify.addHook('preHandler', fastify.auth([fastify.basicAuth]))
            })
            .register(fstatic, { root: path.join(__dirname, 'www') })
            .listen(3000, '0.0.0.0', function (err, address) {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }
                console.log(`server listening on ${address}`);
            });
    }
);
