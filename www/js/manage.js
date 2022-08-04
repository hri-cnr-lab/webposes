var projects;
var datafiles = [];
var datasets = [];
var networks = [];
var datafiles_pops = [], datasets_pops = [], networks_pops = [];
var projects_table, acquisitions_table, datasets_table, models_table;
var currentProject = null;

const adapter = new LocalStorage('db');
const db = low(adapter);


async function loadProjectData(id) {
    await loadJSON('/getDataFilesList?id=' + id, async function(text) {
        datafiles = JSON.parse(text);

        await loadJSON('/getDataSetsList?id=' + id, async function(text) {
            datasets = JSON.parse(text);

            await loadJSON('/getNetworksList?id=' + id, function(text) {
                networks = JSON.parse(text);

                drawDataFilesTable();
            });
        });
    });
}

function showProject(id) {
    let project = db.get('projects').find({ id: id }).value();

    currentProject = id;

    $('#name').html(project.name);

    projects_table.clear();
    acquisitions_table.clear();
    datasets_table.clear();
    models_table.clear();

    (async() => {
        await loadProjectData(id);
    })().then(() => {
        document.getElementById("projects_actions").style.display = 'none';
        document.getElementById("datafiles_actions").style.display = 'flex';
        document.getElementById("acquisitions_div").style.display = 'flex';
        $('#datafiles-tab').tab('show');
    });
}

function drawProjectsTable() {
    projects_table.clear().draw();

    if (projects.length > 0) {
        (async() => {
            for (let i=0; i<projects.length; i++) {
                //let creationDate = new Date(projects[i].creationDate);
                //let lastModified = new Date(projects[i].lastModified);

                projects_table.row.add([
                    "<input type=\"checkbox\" id=\"prj_cb" + i + "\" onchange=\"cbProjects(this);\">",
                    "<a href='#' class='font-weight-bold' onclick='window.location.replace(\"index.html?project=" + projects[i].id + "\"); return false;'>" + projects[i].name + "</a>",
                    projects[i].id,
                    projects[i].architecture,
                    projects[i].detectionType,
                    //creationDate.toLocaleString(),
                    //lastModified.toLocaleString(),
                    "<a tabindex=\"0\" id=\"prj_pop" + i + "\" class=\"text-primary text-decoration-none\" data-toggle=\"popover\" data-trigger=\"focus\" title=\"Project Details\">details</a>"
                ]);
            }
        })().then(() => {
            projects_table.draw();

            // set popover contents
            for (let i=0; i<projects.length; i++) {
                $('#prj_pop' + i).popover({
                    container: 'body',
                    content: setProjectPopoverContent(i),
                    html: true,
                    placement: 'left'
                })
            }
        });
    }    
}

function drawDataFilesTable() {
    acquisitions_table.clear().draw();

    if (datafiles.length > 0) {
        (async() => {
            for (let i=0; i<datafiles.length; i++) {
                acquisitions_table.row.add([
                    "<input type=\"checkbox\" id=\"df_cb" + i + "\" onchange=\"cbDataFile(this);\">",
                    datafiles[i].name,
                    datafiles[i].id, 
                    datafiles[i].stats.lines,
                    "<a tabindex=\"0\" id=\"df_pop" + i + "\" class=\"text-primary text-decoration-none\" data-toggle=\"popover\" data-trigger=\"focus\" title=\"Targets\">details</a>"
                ]);
            }
        })().then(() => {
            acquisitions_table.draw();

            // set popover contents
            for (let i=0; i<datafiles.length; i++) {
                $('#df_pop' + i).popover({
                    container: 'body',
                    content: setDataFilePopoverContent(i),
                    html: true,
                    placement: 'left'
                })
            }
        });
    }
}

function drawDataSetsTable() {
    datasets_table.clear().draw();

    if (datasets.length > 0) {
        (async() => {
            for (let i=0; i<datasets.length; i++) {
                datasets_table.row.add([
                    "<input type=\"checkbox\" id=\"ds_cb" + i + "\" onchange=\"cbDataSet(this);\">",
                    datasets[i].name,
                    datasets[i].id, 
                    datasets[i].type, 
                    datasets[i].stats.lines,
                    "<a tabindex=\"0\" id=\"ds_pop" + i + "\" class=\"text-primary text-decoration-none\" data-toggle=\"popover\" data-trigger=\"focus\" title=\"Targets\">details</a>"
                ]);
            }
        })().then(() => {
            datasets_table.draw();

            // set popover contents
            for (let i=0; i<datasets.length; i++) {
                $('#ds_pop' + i).popover({
                    container: 'body',
                    content: setDataSetPopoverContent(i),
                    html: true,
                    placement: 'left'
                })
            }
        });
    }
}

function drawNetworksTable() {
    models_table.clear().draw();

    if (networks.length > 0) {
        (async() => {
            for (let i=0; i<networks.length; i++) {
                models_table.row.add([
                    "<input type=\"radio\" id=\"net_cb" + i + "\" name=\"net_radio\" onchange=\"cbNetwork(this);\">",
                    networks[i].name,
                    networks[i].id, 
                    networks[i].type
                ]);
            }
        })().then(() => {
            models_table.draw();
        });
    }
}

function prjOpen() {
    for (let i=0; i<projects.length; i++) {
        if (document.getElementById('prj_cb' + i).checked)
            window.location.replace('index.html?project=' + projects[i].id);
    }
}

function deleteProject() {
    alertify.confirm('Deleting the project will also delete all collected data files, training data sets and networks!', 'Are you sure?', 
        function(){ doDelete(currentProject); }, 
        function(){ return; });
}

function doClone(id) {
    loadJSON('/cloneProject?id=' + id, function(text) {
        let res = JSON.parse(text);
        if (res.status == "success") {
            alertify.success('Project cloned', 4, () => { window.location.reload(); });
        }
    });
}

function prjClone() {
    for (let i=0; i<projects.length; i++) {
        if (document.getElementById('prj_cb' + i).checked) {
                alertify.confirm('Cloning a project does not duplicate data files, training data sets and networks.', 'Are you sure?', 
                    function(){ doClone(projects[i].id); }, 
                    function(){ return; });
        }
    }
}

function doDelete(id) {
    loadJSON('/deleteProject?id=' + id, function(text) {
        let res = JSON.parse(text);
        if (res.status == "success") {
            alertify.success('Project deleted', 4, () => { window.location.reload(); });
        }
    });
}

function prjRemove() {
    for (let i=0; i<projects.length; i++) {
        if (document.getElementById('prj_cb' + i).checked) {
                alertify.confirm('Deleting the project will also delete all collected data files, training data sets and networks!', 'Are you sure?', 
                    function(){ doDelete(projects[i].id); }, 
                    function(){ return; });
        }
    }
}

function dfNew() {
    window.location.replace('collect.html?project=' + currentProject);
}

function dfOpen() {
    let df;
    for (let i=0; i<datafiles.length; i++) {
        if (document.getElementById('df_cb' + i).checked)
            df = i;
    }
    window.location.replace('collect.html?project=' + currentProject + '&datafile=' + datafiles[df].id);
}

function dfRemove() {
    alertify.confirm('Datafile(s) removing is an irreversible action!', 'Are you sure?', 
        function(){ doRemoveDataFiles(); }, 
        function(){ return; });
}

function doRemoveDataFiles() {
    let df = [];
    for (let i=0; i<datafiles.length; i++) {
        if (document.getElementById('df_cb' + i).checked)
            df.push(datafiles[i].id);
    }

    let obj = {
        "project": currentProject,
        "datafiles": df
    };

    $.ajax({
        url: '/removeDataFiles',
        type: 'POST',
        data: JSON.stringify(obj),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function(msg) {
            alertify.success('DataFile(s) removed', 3, () => {
                // reload datafiles list
                loadJSON('/getDataFilesList?id=' + currentProject, async function(text) {
                    datafiles = JSON.parse(text);
                    fireEvent('datafiles-tab', 'click')
                });
            });
        }
    });
}

function dsNew() {
    alertify.dsNewDialog || alertify.dialog('dsNewDialog',function(){
            return {
                main:function(content){
                    var form = ' \
                        <form id="hiddenForm"> \
                            <div class="container mb-0"> \
                                <div class="row"> \
                                    <div class="col-4 text-right"> \
                                        Acquisitions: \
                                    </div> \
                                    <div class="col-8" style="padding:0px; margin-top:-7px; margin-left:-2px; margin-bottom:15px;"> \
                                        <select id="acquisitions" class="form-control multiselect" multiple="multiple">';

                    for (i=0; i<datafiles.length; i++)
                        form += '<option value="' + i + '">' + datafiles[i].name + '</option>';

                    form += '           </select> \
                                    </div> \
                                </div> \
                                <div class="row"> \
                                    <div class="col-4 text-right"> \
                                        DataSet Type: \
                                    </div> \
                                    <div class="col-8 form-check"> \
                                        <input class="form-check-input" type="radio" name="datasetType" id="kpradio" value="Keypoints" checked> \
                                        <label class="form-check-label" for="kpradio"> \
                                            Keypoints \
                                        </label> \
                                        <br> \
                                        <input class="form-check-input" type="radio" name="datasetType" id="3jradio" value="3-joints angles"> \
                                        <label class="form-check-label" for="3jradio"> \
                                            3-joints angles \
                                        </label> \
                                        <br> \
                                        <input class="form-check-input" type="radio" name="datasetType" id="tjradio" value="T-joints angles"> \
                                        <label class="form-check-label" for="tjradio"> \
                                            T-joints angles \
                                        </label> \
                                    </div> \
                                </div> \
                                <div class="row mt-3 text-right"> \
                                    <div class="col-4"> \
                                        Score Threshold: \
                                    </div> \
                                    <div class="col-8 text-left"> \
                                        <span style="margin-left: -15px;"><span class="slider-limit-sx">0%</span> <input id="slider" type="text" value="0" data-slider-min="0" data-slider-max="100" data-slider-step="1" data-slider-value="0" data-slider-handle="triangle"/> <span class="slider-limit-dx">100%</span></span> \
                                    </div> \
                                </div> \
                                <div class="row mt-3 align-items-center"> \
                                    <div class="col-4 text-right"> \
                                        <span class="align-middle">DataSet Name:</span> \
                                    </div> \
                                    <div class="col-8 text-left"> \
                                        <input type="text" class="form-control" id="dataSetName" placeholder="..." style="width: 300px; margin-left: -14px;"> \
                                    </div> \
                                </div> \
                            </div> \
                            <div class="text-center mt-4"> \
                                <button type="submit" class="btn btn-primary btn-sm" style="width: 200px;" id="buttonCreate">Build</button> \
                            </div> \
                        </form>';
                    this.setContent(form);
                    $('#acquisitions').multiselect();
                },
                setup:function(){
                    return {
                        focus:{
                            element:function(){
                                return this.elements.body.querySelector(this.get('selector'));
                            },
                            select:true
                        },
                        options:{
                            basic:true,
                            maximizable:false,
                            resizable:false,
                            padding:false
                        }
                    };
                },
                settings:{
                    selector:undefined
                }
            };
    });   

    
    alertify.dsNewDialog($('#hiddenForm')[0]).set('selector', 'input[type="radio"]');

    var mySlider = $("#slider").slider({});
    var $form = $('#hiddenForm');

    $form.on('submit', function (evt) {
        evt.preventDefault();

        let acquisitions = $('select#acquisitions').val();
        
        if (acquisitions.length == 0) {
            $("#acquisitions").addClass('is-invalid');
            return;
        }

        $("#acquisitions").removeClass('is-invalid');

        //console.log($('select#acquisitions').val());
        let df = [];
        for (let i=0; i<acquisitions.length; i++) {
            df.push(datafiles[acquisitions[i]].id);
        }

        //console.log(df);

        let dataSetName = $("#dataSetName").val();
        
        if (dataSetName.length <= 0) {
            $("#dataSetName").addClass('is-invalid');
            return;
        }

        $("#dataSetName").removeClass('is-invalid');

        let threshold = mySlider.slider('getValue');
        let type = document.querySelector('input[name="datasetType"]:checked').value;

        let obj = {
            "project": currentProject,
            "datafiles": df,
            "type": type,
            "scoreThreshold": threshold,
            "name": dataSetName
        };
 
        alertify.dsNewDialog().set('closable', false);

        document.querySelector('#buttonCreate').textContent = 'Building dataset ...';

        $.ajax({
            url: '/services/createDataSet',
            type: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            async: true,
            success: function(msg) {
                alertify.success('DataSet created', 2, () => {
                    alertify.dsNewDialog().close().set('closable', true);
                    loadJSON('/getDataSetsList?id=' + currentProject, async function(text) {
                        datasets = JSON.parse(text);
                        fireEvent('datasets-tab', 'click')
                    });
                });
            }
        });

    });
}

function dsRename() {
    let dsID, dsName;
    for (let i=0; i<datasets.length; i++) {
        if (document.getElementById('ds_cb' + i).checked) {
            dsID = datasets[i].id;
            dsName = datasets[i].name;
        }
    }

    alertify.dsRenameDialog || alertify.dialog('dsRenameDialog',function(){
            return {
                main:function(content){
                    var form = ' \
                        <form id="hiddenForm"> \
                            <div class="container mb-0"> \
                                 <div class="row mt-3 align-items-center"> \
                                    <div class="col-4 text-right"> \
                                        <span class="align-middle">DataSet Name:</span> \
                                    </div> \
                                    <div class="col-8 text-left"> \
                                        <input type="text" class="form-control" id="dataSetName" value="' + dsName + '" style="width: 300px; margin-left: -14px;"> \
                                    </div> \
                                </div> \
                            </div> \
                            <div class="text-center mt-4"> \
                                <button type="submit" class="btn btn-primary btn-sm" style="width: 200px;" id="buttonRename">Rename</button> \
                            </div> \
                        </form>';
                    this.setContent(form);
                },
                setup:function(){
                    return {
                        focus:{
                            element:function(){
                                return this.elements.body.querySelector(this.get('selector'));
                            },
                            select:true
                        },
                        options:{
                            basic:true,
                            maximizable:false,
                            resizable:false,
                            padding:false
                        }
                    };
                }
            };
    });   

    alertify.dsRenameDialog($('#hiddenForm')[0]).set('selector', 'input[type="text"]');

    var $form = $('#hiddenForm');

    $form.on('submit', function (evt) {
        evt.preventDefault();

        let newName = $("#dataSetName").val();
        
        if (newName.length <= 0) {
            $("#dataSetName").addClass('is-invalid');
            return;
        }

        $("#dataSetName").removeClass('is-invalid');

        let obj = {
            "id": dsID,
            "name": newName
        };
 
        alertify.dsRenameDialog().set('closable', false);

        $.ajax({
            url: '/services/renameDataSet',
            type: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            async: true,
            success: function(msg) {
                alertify.success('DataSet renamed', 2, () => {
                    alertify.dsRenameDialog().close().set('closable', true);
                    loadJSON('/getDataSetsList?id=' + currentProject, async function(text) {
                        datasets = JSON.parse(text);
                        fireEvent('datasets-tab', 'click')
                    });
                });
            }
        });

    });
}

function dsDelete() {
    alertify.confirm('Delete dataset(s) is an irreversible action!', 'Are you sure?', 
        function(){ doRemoveDataSets(); }, 
        function(){ return; });
}

function doRemoveDataSets() {
    let ds = [];
    for (let i=0; i<datasets.length; i++) {
        if (document.getElementById('ds_cb' + i).checked)
            ds.push(datasets[i].id);
    }

    let obj = {
        "project": currentProject,
        "datasets": ds
    };

    $.ajax({
        url: '/services/removeDataSets',
        type: 'POST',
        data: JSON.stringify(obj),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function(msg) {
            alertify.success('DataSet(s) removed', 2, () => {
                // reload datafiles list
                loadJSON('/getDataSetsList?id=' + currentProject, async function(text) {
                    datasets = JSON.parse(text);
                    drawDataSetsTable();
                });
            });
        }
    });
}

function doRemoveNetwork() {
    let selected = document.querySelector('input[name="net_radio"]:checked').id.substr(6);

    let obj = {
        "project": currentProject,
        "network": networks[selected].id
    };

    $.ajax({
        url: '/services/removeNetwork',
        type: 'POST',
        data: JSON.stringify(obj),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function(msg) {
            alertify.success('Model deleted', 2, () => {
                // reload networks list
                loadJSON('/getNetworksList?id=' + currentProject, async function(text) {
                    networks = JSON.parse(text);
                    drawNetworksTable();
                });
            });
        }
    });
}

function downloadFile(filename) {
  const a = document.createElement('a');
  
  a.href = 'models/' + currentProject + '/' + filename;
  a.download = filename;
  
  const clickHandler = () => {
    setTimeout(() => {
      this.removeEventListener('click', clickHandler);
    }, 150);
  };

  a.addEventListener('click', clickHandler, false);
  a.click(); 
  a.remove();
}

function netNew() {
    alertify.netNewDialog || alertify.dialog('netNewDialog',function(){
            return {
                main:function(content){
                    var form = ' \
                        <form id="hiddenForm"> \
                            <div class="container mb-0"> \
                                <div class="row"> \
                                    <div class="col-4 text-right"> \
                                        DataSet: \
                                    </div> \
                                    <div class="col-6" style="padding:0px; margin-top:-7px; margin-left:-2px; margin-bottom:15px;"> \
                                        <select id="datasets" class="form-control"> \
                                            <option value="-1">None selected</option>';

                    for (i=0; i<datasets.length; i++)
                        form += '<option value="' + i + '">' + datasets[i].name + '</option>';

                    form += '           </select> \
                                    </div> \
                                </div> \
                            <div class="text-center mt-4"> \
                                <button type="submit" class="btn btn-primary btn-sm" style="width: 200px;" id="buttonCreate">Build Model</button> \
                            </div> \
                        </form>';
                    this.setContent(form);
                },
                setup:function(){
                    return {
                        focus:{
                            element:function(){
                                return this.elements.body.querySelector(this.get('selector'));
                            },
                            select:true
                        },
                        options:{
                            basic:true,
                            maximizable:false,
                            resizable:false,
                            padding:false
                        }
                    };
                },
                settings:{
                    selector:undefined
                }
            };
    });   

    
    alertify.netNewDialog($('#hiddenForm')[0]).set('selector', 'input[type="radio"]');

    var $form = $('#hiddenForm');

    $form.on('submit', function (evt) {
        evt.preventDefault();

        let dset = $('select#datasets').val();
        
        if (dset == -1) {
            $("#datasets").addClass('is-invalid');
            return;
        }

        $("#datasets").removeClass('is-invalid');

        window.location.replace('train.html?project=' + currentProject + '&dataset=' + datasets[dset].id);
    });
}

function netDownload() {
    let selected = document.querySelector('input[name="net_radio"]:checked').id.substr(6);
    let networkID = networks[selected].id;

    downloadFile(networkID + '.json');
    downloadFile(networkID + '.weights.bin');
}

function netH5() {
    let selected = document.querySelector('input[name="net_radio"]:checked').id.substr(6);
    let networkID = networks[selected].id;

    let obj = {
        "project": currentProject,
        "network": networkID
    };

    $.ajax({
        url: '/services/exportNetwork',
        type: 'POST',
        data: JSON.stringify(obj),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function(msg) {
            if (msg.status == 0)
                downloadFile(networkID + '.h5');
        }
    });
}

function netRemove() {
    alertify.confirm('Deleting a model is an irreversible action!', 'Are you sure?', 
        function(){ doRemoveNetwork(); }, 
        function(){ return; });
}

function netClassify() {
    let selected = document.querySelector('input[name="net_radio"]:checked').id.substr(6);
    window.location.replace('classify.html?project=' + currentProject + '&network=' + networks[selected].id);
}

function cbNetwork(cb) {
    //console.log(cb.id);
    document.getElementById("netClassify").removeAttribute("disabled");
    document.getElementById("netRemove").removeAttribute("disabled");
    document.getElementById("netDownload").removeAttribute("disabled");
    document.getElementById("netH5").removeAttribute("disabled");
}

function cbDataSet(cb) {
    let checkedCount = 0;
    for (let i=0; i<datasets.length; i++) {
        if (document.getElementById('ds_cb' + i).checked)
            checkedCount++;
    }
    switch (checkedCount) {
        case 0:
            document.getElementById("dsRename").setAttribute("disabled", "disabled");
            //document.getElementById("dsTrain").setAttribute("disabled", "disabled");
            document.getElementById("dsDelete").setAttribute("disabled", "disabled");
            break;
        case 1:
            document.getElementById("dsRename").removeAttribute("disabled");
            //document.getElementById("dsTrain").removeAttribute("disabled");
            document.getElementById("dsDelete").removeAttribute("disabled");
            break;
        default:
            document.getElementById("dsRename").setAttribute("disabled", "disabled");
            //document.getElementById("dsTrain").setAttribute("disabled", "disabled");
            document.getElementById("dsDelete").removeAttribute("disabled");
    }    
}

function cbDataFile(cb) {
    let checkedCount = 0;
    for (let i=0; i<datafiles.length; i++) {
        if (document.getElementById('df_cb' + i).checked)
            checkedCount++;
    }
    switch (checkedCount) {
        case 0:
            document.getElementById("dfNew").removeAttribute("disabled");
            document.getElementById("dfOpen").setAttribute("disabled", "disabled");
            document.getElementById("dfRemove").setAttribute("disabled", "disabled");
            //document.getElementById("dfDataSet").setAttribute("disabled", "disabled");
            break;
        case 1:
            document.getElementById("dfNew").setAttribute("disabled", "disabled");
            document.getElementById("dfOpen").removeAttribute("disabled");
            document.getElementById("dfRemove").removeAttribute("disabled");
            //document.getElementById("dfDataSet").removeAttribute("disabled");
            break;
        default:
            document.getElementById("dfNew").setAttribute("disabled", "disabled");
            document.getElementById("dfOpen").setAttribute("disabled", "disabled");
            document.getElementById("dfRemove").removeAttribute("disabled");
            //document.getElementById("dfDataSet").removeAttribute("disabled");
    }
}

function cbProjects(cb) {
    let checkedCount = 0;
    for (let i=0; i<projects.length; i++) {
        if (document.getElementById('prj_cb' + i).checked)
            checkedCount++;
    }
    switch (checkedCount) {
        case 0:
            document.getElementById("prjNew").removeAttribute("disabled");
            document.getElementById("prjOpen").setAttribute("disabled", "disabled");
            document.getElementById("prjClone").setAttribute("disabled", "disabled");
            document.getElementById("prjRemove").setAttribute("disabled", "disabled");
            //document.getElementById("dfDataSet").setAttribute("disabled", "disabled");
            break;
        case 1:
            document.getElementById("prjNew").setAttribute("disabled", "disabled");
            document.getElementById("prjOpen").removeAttribute("disabled");
            document.getElementById("prjClone").removeAttribute("disabled");
            document.getElementById("prjRemove").removeAttribute("disabled");
            //document.getElementById("dfDataSet").removeAttribute("disabled");
            break;
        default:
            document.getElementById("prjNew").setAttribute("disabled", "disabled");
            document.getElementById("prjOpen").setAttribute("disabled", "disabled");
            document.getElementById("prjClone").setAttribute("disabled", "disabled");
            document.getElementById("prjRemove").removeAttribute("disabled");
            //document.getElementById("dfDataSet").removeAttribute("disabled");
    }
}

function setProjectPopoverContent(idx) {
    let p = projects[idx];

    let str = ' \
        <div class="row small text-monospace"> \
            <div class="col font-weight-bold">inputResolution</div> \
            <div class="col text-right">' + p.inputResolution + '</div> \
        </div> \
        <div class="row small text-monospace"> \
            <div class="col font-weight-bold">flipHorizontal</div> \
            <div class="col text-right">' + p.flipHorizontal + '</div> \
        </div> \
        <div class="row small text-monospace"> \
            <div class="col font-weight-bold">outputStride</div> \
            <div class="col text-right">' + p.outputStride + '</div> \
        </div> \
        <div class="row small text-monospace"> \
            <div class="col font-weight-bold">quantBytes</div> \
            <div class="col text-right">' + p.quantBytes + '</div> \
        </div>';

    if (p.detectionType == 'multiple')
        str +=  '<div class="row small text-monospace"> \
                    <div class="col font-weight-bold">maxPoseDetections</div> \
                    <div class="col text-right">' + p.maxPoseDetections + '</div> \
                </div>';

    if (p.architecture == 'MobileNetV1')
        str +=  '<div class="row small text-monospace"> \
                    <div class="col font-weight-bold">scoreThreshold</div> \
                    <div class="col text-right">' + p.scoreThreshold + '</div> \
                </div> \
                <div class="row small text-monospace"> \
                    <div class="col font-weight-bold">nmsRadius</div> \
                    <div class="col text-right">' + p.nmsRadius + '</div> \
                </div> \
                <div class="row small text-monospace"> \
                    <div class="col font-weight-bold">multiplier</div> \
                    <div class="col text-right">' + p.multiplier + '</div> \
                </div>';

    return str;               
}

function setDataFilePopoverContent(idx) {
    let str = "";
    for (i=0; i<datafiles[idx].stats.targets.length; i++) {
        str +=  "<div class=\"row small text-monospace\">" +
                    "<div class=\"col font-weight-bold\">" + datafiles[idx].stats.targets[i].target + "</div>" + 
                    "<div class=\"col text-right\">" + datafiles[idx].stats.targets[i].count + "</div>" +
                "</div>";
    }
    return str;               
}

function setDataSetPopoverContent(idx) {
    let str = "";
    for (i=0; i<datasets[idx].stats.targets.length; i++) {
        str +=  "<div class=\"row small text-monospace\">" +
                    "<div class=\"col font-weight-bold\">" + datasets[idx].stats.targets[i].target + "</div>" + 
                    "<div class=\"col text-right\">" + datasets[idx].stats.targets[i].count + "</div>" +
                "</div>";
    }
    return str;               
}

function showProjectsActions() {
    drawProjectsTable();

    document.getElementById("projects_actions").style.display = 'flex';
    document.getElementById("projects_div").style.display = 'flex';
    document.getElementById("datafiles_actions").style.display = 'none';
    document.getElementById("acquisitions_div").style.display = 'none';
    document.getElementById("datasets_actions").style.display = 'none';
    document.getElementById("datasets_div").style.display = 'none';
    document.getElementById("networks_actions").style.display = 'none';
    document.getElementById("models_div").style.display = 'none';

    document.getElementById("prjNew").removeAttribute("disabled");
    document.getElementById("prjOpen").setAttribute("disabled", "disabled");
    document.getElementById("prjRemove").setAttribute("disabled", "disabled");

    if (currentProject != null) {
    }
}

function showDataFilesActions() {
    document.getElementById("projects_actions").style.display = 'none';
    document.getElementById("projects_div").style.display = 'none';

    if (currentProject != null) {
        drawDataFilesTable();

        document.getElementById("datafiles_actions").style.display = 'flex';
        document.getElementById("acquisitions_div").style.display = 'flex';
        document.getElementById("datasets_actions").style.display = 'none';
        document.getElementById("datasets_div").style.display = 'none';
        document.getElementById("networks_actions").style.display = 'none';
        document.getElementById("models_div").style.display = 'none';

        document.getElementById("dfNew").removeAttribute("disabled");
        document.getElementById("dfOpen").setAttribute("disabled", "disabled");
        document.getElementById("dfRemove").setAttribute("disabled", "disabled");
    }
}

function showDataSetsActions() {
    document.getElementById("projects_actions").style.display = 'none';
    document.getElementById("projects_div").style.display = 'none';

    if (currentProject != null) {
        drawDataSetsTable();

        document.getElementById("datafiles_actions").style.display = 'none';
        document.getElementById("acquisitions_div").style.display = 'none';
        document.getElementById("datasets_actions").style.display = 'flex';
        document.getElementById("datasets_div").style.display = 'flex';
        document.getElementById("networks_actions").style.display = 'none';
        document.getElementById("models_div").style.display = 'none';

        if (datafiles.length > 0)
            document.getElementById("dsNew").removeAttribute("disabled");
        else
            document.getElementById("dsNew").setAttribute("disabled", "disabled");
        document.getElementById("dsRename").setAttribute("disabled", "disabled");
        document.getElementById("dsDelete").setAttribute("disabled", "disabled");
    }
}

function showNetworksActions() {
    document.getElementById("projects_actions").style.display = 'none';
    document.getElementById("projects_div").style.display = 'none';

        drawNetworksTable();

    if (currentProject != null) {

        document.getElementById("datafiles_actions").style.display = 'none';
        document.getElementById("acquisitions_div").style.display = 'none';
        document.getElementById("datasets_actions").style.display = 'none';
        document.getElementById("datasets_div").style.display = 'none';
        document.getElementById("networks_actions").style.display = 'flex';
        document.getElementById("models_div").style.display = 'flex';

        if (datasets.length > 0)
            document.getElementById("netNew").removeAttribute("disabled");
        else
            document.getElementById("netNew").setAttribute("disabled", "disabled");
        document.getElementById("netClassify").setAttribute("disabled", "disabled");
        document.getElementById("netRemove").setAttribute("disabled", "disabled");
        document.getElementById("netDownload").setAttribute("disabled", "disabled");
        document.getElementById("netH5").setAttribute("disabled", "disabled");
    }
}

function autoSelectProject() {
    showProject($.urlParam('project'));
}


function main() {
    // override defaults
    alertify.defaults.transition = "slide";
    alertify.defaults.theme.ok = "btn btn-primary";
    alertify.defaults.theme.cancel = "btn btn-danger";
    alertify.defaults.theme.input = "form-control";

    $('.popover-dismiss').popover({
      trigger: 'focus'
    });

    document.getElementById("projects_actions").style.display = 'none';
    document.getElementById("datafiles_actions").style.display = 'none';
    document.getElementById("datasets_actions").style.display = 'none';
    document.getElementById("networks_actions").style.display = 'none';

    db.defaults({ projects: [] }).write();

    loadJSON('/getProjects', function(text) {
        projects = JSON.parse(text);

        db.set('projects', projects).write();

        projects_table = $('#projects_table').DataTable({
            scrollY: 200,
            scrollCollapse: true,
            paging: false,
            searching: false,
            ordering: false,
            info: false,
            "columns": [
                { "width": "10px" },
                { "title": "name", "width": "180px" },
                { "title": "id", "width": "280px"},
                { "title": "architecture", "width": "60px"},
                { "title": "poses", "width": "20px" },
                //{ "title": "created", "width": "60px" },
                //{ "title": "modified", "width": "60px" },
                { "width": "30px" }
            ],
            "autoWidth": false,
            "responsive": false
        });

        acquisitions_table = $('#acquisitions_table').DataTable({
            scrollY: 200,
            scrollCollapse: true,
            paging: false,
            searching: false,
            ordering: false,
            info: false,
            "columns": [
                { "width": "10px" },
                { "title": "name", "width": "200px"},
                { "title": "id", "width": "280px"},
                { "title": "poses", "width": "30px" }
            ],
            "autoWidth": false,
            "responsive": false
        });

        datasets_table = $('#datasets_table').DataTable({
            scrollY: 200,
            scrollCollapse: true,
            paging: false,
            searching: false,
            ordering: false,
            info: false,
            "columns": [
                { "width": "10px" },
                { "title": "name", "width": "200px" },
                { "title": "id", "width": "280px"},
                { "title": "type", "width": "80px" },
                { "title": "poses", "width": "20px" },
                { "width": "30px" }
            ],
            "autoWidth": false,
            "responsive": false
        });

        models_table = $('#models_table').DataTable({
            scrollY: 200,
            scrollCollapse: true,
            paging: false,
            searching: false,
            ordering: false,
            info: false,
            "columns": [
                { "width": "10px" },
                { "title": "name", "width": "200px" },
                { "title": "id", "width": "280px"},
                { "title": "type", "width": "80px" }
            ],
            "autoWidth": false,
            "responsive": false
        });

        if ($.urlParam('project') != null)
            setTimeout(autoSelectProject, 500);
        else
            showProjectsActions();
    });

}

document.addEventListener("DOMContentLoaded", function() {
    main();
});