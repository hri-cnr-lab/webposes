var architecture;

function scroll_to_class(element_class, removed_height) {
	var scroll_to = $(element_class).offset().top - removed_height;
	if($(window).scrollTop() != scroll_to) {
		$('html, body').stop().animate({scrollTop: scroll_to}, 0);
	}
}

function bar_progress(progress_line_object, direction) {
	var number_of_steps = progress_line_object.data('number-of-steps');
	var now_value = progress_line_object.data('now-value');
	var new_value = 0;
	if(direction == 'right') {
		new_value = now_value + ( 100 / number_of_steps );
	}
	else if(direction == 'left') {
		new_value = now_value - ( 100 / number_of_steps );
	}
	progress_line_object.attr('style', 'width: ' + new_value + '%;').data('now-value', new_value);
}

// Restricts input for each element in the set of matched elements to the given inputFilter.
(function($) {
  $.fn.inputFilter = function(inputFilter) {
    return this.on("input keydown keyup mousedown mouseup select contextmenu drop", function() {
      if (inputFilter(this.value)) {
        this.oldValue = this.value;
        this.oldSelectionStart = this.selectionStart;
        this.oldSelectionEnd = this.selectionEnd;
      } else if (this.hasOwnProperty("oldValue")) {
        this.value = this.oldValue;
        this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
      } else {
        this.value = "";
      }
    });
  };
}(jQuery));

(function ($) {
    $.fn.serializeFormJSON = function () {

        var o = {};
        var a = this.serializeArray();
        $.each(a, function () {
            if (o[this.name]) {
                if (!o[this.name].push) {
                    o[this.name] = [o[this.name]];
                }
                o[this.name].push(this.value || '');
            } else {
                o[this.name] = this.value || '';
            }
        });
        return o;
    };
})(jQuery);

$("#scoreThreshold").inputFilter(function(value) {
    return /^-?\d*[.,]?\d*$/.test(value) && ((Number(value)>=0) && (Number(value)<=1));
});

$("#nmsRadius").inputFilter(function(value) {
    return /^\d*$/.test(value) && (parseInt(value) >= 1) && (parseInt(value) <= 50);
});

$("#maxPoseDetections").inputFilter(function(value) {
    return /^\d*$/.test(value) && (parseInt(value) >= 1) && (parseInt(value) <= 10);
});

$("#name").inputFilter(function(value) {
    //console.log(value);
    let test = /^[A-Za-z0-9]*$/i.test(value) && value.length > 0;
    $('#submit').prop('disabled', !test);
    return test;
});

jQuery(document).ready(function() {
	    
    /*
        Form
    */
    $('.f1 fieldset:first').fadeIn('slow');
    
    $('.f1 input[type="radio"]').on('click', function() {
        $('#firstbutton').prop('disabled', false);
        architecture = $("input[name='architecture']:checked").val();

        if (architecture == "MobileNetV1") {
            document.getElementById("multiplierDiv").style.display = 'flex';
        } else {
            document.getElementById("multiplierDiv").style.display = 'none';
        }

        let detectionType = $("input[name='detectionType']:checked").val();
        if (detectionType == "single") {
            document.getElementById("maxPosesDiv").style.display = 'none';
        } else {
            document.getElementById("maxPosesDiv").style.display = 'flex';
        }

        $('#outputStride').empty();
        let output = [];

        if (architecture == "MobileNetV1")
            output.push('<option value="8">8</option>');

        output.push('<option selected value="16">16</option>');
        output.push('<option value="32">32</option>');

        $('#outputStride').html(output.join(''));
    });

    // next step
    $('.f1 .btn-primary').on('click', function() {
    	var parent_fieldset = $(this).parents('fieldset');
    	// navigation steps / progress steps
    	var current_active_step = $(this).parents('.f1').find('.f1-step.active');
    	var progress_line = $(this).parents('.f1').find('.f1-progress-line');
    	
		parent_fieldset.fadeOut(200, function() {
			// change icons
			current_active_step.removeClass('active').addClass('activated').next().addClass('active');
			// progress bar
			bar_progress(progress_line, 'right');
			// show next step
    		$(this).next().fadeIn();
    		// scroll window to beginning of the form
			scroll_to_class( $('.f1'), 20 );
    	});
    	
    });
    
    // previous step
    $('.f1 .btn-secondary').on('click', function() {
    	// navigation steps / progress steps
    	var current_active_step = $(this).parents('.f1').find('.f1-step.active');
    	var progress_line = $(this).parents('.f1').find('.f1-progress-line');
    	
    	$(this).parents('fieldset').fadeOut(200, function() {
    		// change icons
    		current_active_step.removeClass('active').prev().removeClass('activated').addClass('active');
    		// progress bar
    		bar_progress(progress_line, 'left');
    		// show previous step
    		$(this).prev().fadeIn();
    		// scroll window to beginning of the form
			scroll_to_class( $('.f1'), 20 );
    	});
    });
    
    // submit
    $('.f1').on('submit', function(e) {
        e.preventDefault();

        var data = $(this).serializeFormJSON();

        data.outputStride = Number(data.outputStride);
        data.inputResolution = Number(data.inputResolution);
        data.quantBytes = Number(data.quantBytes);
        data.scoreThreshold = Number(data.scoreThreshold);
        data.nmsRadius = Number(data.nmsRadius);
        data.flipHorizontal = (data.flipHorizontal == 'true');

        if (data.detectionType == "single")
            delete data.maxPoseDetections;
        else
            data.maxPoseDetections = Number(data.maxPoseDetections);

        if (data.architecture == "ResNet50")
            delete data.multiplier;
        else
            data.multiplier = Number(data.multiplier);

        console.log(data);

        $.ajax({
            url: '/services/createProject',
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            async: true,
            success: function(msg) {
                alertify.success('Project created', 2, () => { window.location.replace("/"); });
            }
        });
    });    
    
});
