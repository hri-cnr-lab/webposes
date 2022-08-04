// Original version by Mateusz Rybczonec

const bt_FULL_DASH_ARRAY = 283;
const bt_COLOR_CODES = {
  info: {
    color: "green"
  },
  warning: {
    color: "orange"
  },
  alert: {
    color: "red"
  }
};

let bt_dialogID = null;
let bt_timeLimit;
let bt_alertThreshold;
let bt_warningThreshold;
let bt_timePassed;
let bt_timeLeft = bt_timeLimit;
let bt_remainingPathColor = bt_COLOR_CODES.info.color;

function bt_start(dialogID, timeLimit, title) {
  if (dialogID == null)
    return;

  bt_timeLimit = timeLimit;
  bt_timeLeft = timeLimit;
  bt_timePassed = 0;
  bt_warningThreshold = Math.round(bt_timeLimit / 2);
  bt_alertThreshold = Math.round(bt_warningThreshold / 2);
  bt_dialogID = dialogID;

  //console.log("warning: " + bt_warningThreshold);
  //console.log("alert: " + bt_alertThreshold);

  // document.getElementById(bt_dialogID).innerHTML =
  $(bt_dialogID).html(`
    <div class="base-timer">
      <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g class="base-timer__circle">
          <circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
          <path
            id="base-timer-path-remaining"
            stroke-dasharray="283"
            class="base-timer__path-remaining ${bt_remainingPathColor}"
            d="
              M 50, 50
              m -45, 0
              a 45,45 0 1,0 90,0
              a 45,45 0 1,0 -90,0
            "
          ></path>
        </g>
      </svg>
      <span id="base-timer-label" class="base-timer__label">${bt_timeLeft}</span>
    </div>
  `);

  $(bt_dialogID).dialog("option", "title", title);
  $(bt_dialogID).dialog('open');

  bt_timer();
}


function bt_timer() {
  setTimeout(function step() {
    bt_timePassed++;
    bt_timeLeft = bt_timeLimit - bt_timePassed;

    document.getElementById("base-timer-label").innerHTML = bt_timeLeft;

    bt_setCircleDasharray();
    bt_setRemainingPathColor(bt_timeLeft);

    if (bt_timeLeft > 0)
      setTimeout(step, 1000);
    else
      $(bt_dialogID).dialog('close');
  }, 1000);
}

function bt_formatTime(time) {
  const minutes = Math.floor(time / 60);
  let seconds = time % 60;

  if (seconds < 10) {
    seconds = `0${seconds}`;
  }

  return `${minutes}:${seconds}`;
}

function bt_setRemainingPathColor(timeLeft) {
  const { alert, warning, info } = bt_COLOR_CODES;
  if (bt_timeLeft <= bt_alertThreshold) {
    document
      .getElementById("base-timer-path-remaining")
      .classList.remove(warning.color);
    document
      .getElementById("base-timer-path-remaining")
      .classList.add(alert.color);
  } else if (timeLeft <= bt_warningThreshold) {
    document
      .getElementById("base-timer-path-remaining")
      .classList.remove(info.color);
    document
      .getElementById("base-timer-path-remaining")
      .classList.add(warning.color);
  }
}

function bt_calculateTimeFraction() {
  const rawTimeFraction = bt_timeLeft / bt_timeLimit;
  return rawTimeFraction - (1 / bt_timeLimit) * (1 - rawTimeFraction);
}

function bt_setCircleDasharray() {
  const circleDasharray = `${(
    bt_calculateTimeFraction() * bt_FULL_DASH_ARRAY
  ).toFixed(0)} 283`;
  document
    .getElementById("base-timer-path-remaining")
    .setAttribute("stroke-dasharray", circleDasharray);
}