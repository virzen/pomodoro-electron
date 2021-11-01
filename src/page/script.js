(function (doc, win) {
	'use strict';

	// Helper functions and polyfills
	// ES6 `Array.from` polyfill
	if (!Array.from) {
		Array.from = function (pseudoArray) {
			return Array.prototype.slice.call(pseudoArray);
		};
	}

	// ES6 `Array.prototype.find` polyfill
	if (!Array.prototype.find) {
		Array.prototype.find = function (filterFunc) {
			return this.filter(filterFunc)[0];
		};
	}

	// ES6 `String.prototype.repeat` polyfill
	if (!String.prototype.repeat) {
		String.prototype.repeat = function (times) {
			let result = '';
			for (let i = 0; i < times; i++) {
				result += this;
			}

			return result;
		};
	}

	// Universal query selector
	const $ = function (selector, root = document) {
		if (selector) {
			let elements = root.querySelectorAll(selector);
			return (elements.length === 1) ?
				elements[0] :
				Array.from(elements);
		}
		else {
			return null;
		}
	};

	// Tests given value against expected type
	const is = function (value, expectedType) {
		if (value !== undefined && typeof value === expectedType) {
			return true;
		}
		else {
			return false;
		}
	};

	// Converts given value to string and prepends zeros at the beggining untill
	// length in `digits` is achieved
	// If nothing to prepend, returns string from given value
	const toDigits = function toDigits(value, digits = 2) {
		const strVal = String(value);
		const len = strVal.length;

		if (len >= digits) {
			return strVal;
		}
		else {
			return '0'.repeat(digits - len) + strVal;
		}
	};

	// Timer object contructor
	// Tt attaches few methods and properties to objects from model, making
	// it easier to operate application
	// It is called in init function on all timers in model
	const timerConstr = function (spec) {
		// Validate object properties
		let hasDurationNonNumberValues = spec.duration.some(value =>
			typeof value !== 'number');
		if (hasDurationNonNumberValues) {
			throw new Error(`Given object has invalid values.`);
		}

		let that = {};
		let name = spec.name;
		let duration = Array.from(spec.duration).map(val => parseInt(val, 10));
		let initialDuration = Array.from(spec.duration);
		let interval = null;

		// Object methods declaration
		// They will be attached to the new object later
		// See: 'revealing module pattern'

		// diff - number of seconds to add (may be negative number)
		const changeDurationBy = function changeDurationBy(diff, array) {
			// validate input
			if (!is(diff, 'number')) {
				throw new Error(`Incorrect time difference: ${diff}`);
			}

			// pick given array or private duration array
			array = (array && Array.from(array))
				|| duration;
			let length = array.length;
			// apply diff to the last elements of the array and store
			// the result for later verification
			let appliedDiff = array[length - 1] + diff;

			// test if applying diff produces correct value
			// (i. e. between 0 and 59 inclusive)
			if (appliedDiff >= 0 && appliedDiff < 60) {
				// apply diff to array
				array[length - 1] += diff;
				return array;
			}
			// test if next (second last) element exists and is a number
			else if (is(array[length - 2], 'number')) {
				// apply difference
				let modDiff = diff % 60;
				array[length - 1] += (modDiff < 0) ? 60 + modDiff : modDiff;
				// return result of calling this function recursively with
				// diff divided by 60 (conversion to the next time value, e. g.
				// seconds -> minutes) and array without last element,
				// concatenated with differentiated value
				let result = changeDurationBy(Math.floor(diff / 60), array.slice(0, length - 1));
				if (result) {
					return result.concat(array[length - 1]);
				}
				else {
					return result;
				}
			}
			else {
				// this means the diff couldn't have been fully applied to the
				// array
				return null;
			}
		};

		// Decrements duration of timer each second
		// Sets `interval` property on object it is called from
		// Executes first callback each second and passes the second one to
		// function fired at timer's finish
		const startTimer = function (intervalCallback, endCallback) {
			if (!interval) {
				interval = setInterval(() => {
					let changedDuration = changeDurationBy(-1);

					if (changedDuration) {
						duration = changedDuration;
						if (is(intervalCallback, 'function')) {
							intervalCallback();
						}
					}
					else {
						if (is(endCallback, 'function')) {
							finishTimer(endCallback);
						}
						else {
							finishTimer();
						}
					}
				}, 1000);
			}
		};

		// Stops timer by clearing its interval and executes callback afterwards
		const stopTimer = function (callback) {
			if (interval) {
				clearInterval(interval);
				interval = null;
			}

			if (is(callback, 'function')) {
				callback();
			}
		};

		// Stops timer and resets it by setting duration value back to the
		// initial one, defined at the creation time
		// Executes callback (if any) afterwards
		const resetTimer = function (callback) {
			stopTimer();

			// Set initial duration as the current one
			// It is important to note that initial duration is being cloned
			// instead of being simply assigned. It has to be since assignement
			// would create reference to the initial value. That would cause any
			// change to the current duration be reflected in initial one,
			// rendering it unusable.
			duration = Array.from(initialDuration);

			if (is(callback, 'function')) {
				callback();
			}
		};

		// Stops timer, optionally passing callback
		// Executed when timer reaches 00:00
		const finishTimer = function (callback) {
			if (is(callback, 'function')) {
				stopTimer(callback);
			}
			else {
				stopTimer();
			}
		};

		const serialize = () => {
			return { name, duration };
		}

		// Assign public methods to the new object
		that = {
			get name() {
				return name;
			},
			get duration() {
				return duration;
			},
			get initialDuration() {
				return initialDuration;
			},
			set initialDuration(value) {
				initialDuration = value;
			}
		};
		that.start = startTimer;
		that.stop = stopTimer;
		that.reset = resetTimer;
		that.changeDurationBy = changeDurationBy;
		that.serialize = serialize;


		// Return the new object
		return that;
	};


	const localStorageKey = 'pomodoro-electron-timers'

	function readTimers() {
		const saved = window.localStorage.getItem(localStorageKey)
		return saved && JSON.parse(saved)
	}

	function saveTimers(timers) {
		return window.localStorage.setItem(localStorageKey, JSON.stringify(timers))
	}

	const defaultTimers = [
		{
			name: 'pomodoro',
			duration: [25, 0]
		},
		{
			name: 'short break',
			duration: [5, 0]
		},
		{
			name: 'long break',
			duration: [20, 0]
		}
	]


	// application's singleton
	const app = (function () {
		// App's model
		// An idea of this object is to be as independent as possible
		// It might be fetched through ajax or localStorage, so it should be
		// JSON compatible (e. g. no methods)
		const data = {
			timers: readTimers() || defaultTimers,
		};

		// State contains application-specific version of the data
		// That might mean objects from data with some added methods
		// Tt might synchronize raw data with model
		// It is initialized in init function
		const state = {
			timers: [],
			currentTimerId: 0
		};


		// DOM elements
		////////////////////////
		// Containers
		const appBody = $('.app-body');
		const mainTimer = $('.timer', appBody);
		const timersList = $('.timers-list', appBody);

		// Elements
		const elems = {
			mainTimer: {
				name: $('.timer__name', mainTimer),
				time: $('.timer__time', mainTimer),
				sound: $('.timer__sound', mainTimer),
			},
			buttons: {
				start: $('.start-button', appBody),
				stop: $('.stop-button', appBody),
				reset: $('.reset-button', appBody),
				plus: $('.plus-button', appBody),
				minus: $('.minus-button', appBody),
			},
			timers: [],
		};


		const setCurrentTimer = function (timerId, callback) {
			// TODO: validate timerId
			let timerIdNum = parseInt(timerId, 10);

			state.currentTimerId = timerIdNum;

			if (is(callback, 'function')) {
				callback();
			}
		};


		const renderMainTimer = function (timerId = state.currentTimerId) {
			// Use current timer or search for timer object with given id
			const currentTimer = state.timers[timerId];

			if (currentTimer) {
				const name = currentTimer.name;
				const time = currentTimer.duration.map(value => toDigits(value));

				// Set name and time to currentTimer's ones
				elems.mainTimer.name.textContent = name;
				elems.mainTimer.time.textContent = `${time[0]}:${time[1]}`;
			} else {
				throw new Error(`Given timer doesn't exist.`);
			}
		};

		const renderTimersListItem = function (item, index) {
			const name = item.name;
			const duration = Array.from(item.initialDuration).map(value => toDigits(value, 2));
			const itemTemplate = `
				<li class="timers-list__item">
					<button type="button"
						class="timers-list__select-button button"
						data-timer-id="${index}"
					>
						<span class="name">${name}</span>
						<span class="duration">${duration[0]}:${duration[1]}</span>
					</button>
				</li>
			`;

			timersList.insertAdjacentHTML('beforeend', itemTemplate);
		};

		const renderTimersList = function () {
			timersList.innerHTML = '';
			state.timers.forEach(renderTimersListItem);
			elems.timers = $('.timers-list__select-button', timersList);

			// Call setCurrentTimer on click on timers list's element and use
			// its data-timer-id as timer's id
			elems.timers.forEach(timer => {
				timer.addEventListener('click', ev => {
					setCurrentTimer(ev.currentTarget.dataset.timerId, renderMainTimer);
				});
			});
		};


		// Executed when timer reaches 00:00
		const signalizeTimerFinish = function () {
			elems.mainTimer.sound.play();
		};

		const getSerializedTimers = () => {
			return state.timers.map(t => t.serialize());
		}


		const init = function () {
			// initialize state
			data.timers.forEach(timer => {
				state.timers.push(timerConstr(timer));
			});

			// Render timers list from state
			// Tt also adds each DOM element to elems.timers, so it's necessary
			// for the next step
			renderTimersList();


			// Attach event listeners to clock controls
			elems.buttons.start.addEventListener('click', () => {
				state.timers[state.currentTimerId]
					.start(renderMainTimer, signalizeTimerFinish);
			}, false);
			elems.buttons.stop.addEventListener('click', () => {
				state.timers[state.currentTimerId].stop();
				renderMainTimer();
			}, false);
			elems.buttons.reset.addEventListener('click', () => {
				state.timers[state.currentTimerId].reset();
				renderMainTimer();
			}, false);
			elems.buttons.plus.addEventListener('click', () => {
				const currentTimer = state.timers[state.currentTimerId];
				currentTimer.initialDuration = currentTimer.changeDurationBy(60, currentTimer.initialDuration);
				currentTimer.reset();
				renderMainTimer();
				renderTimersList();
				saveTimers(getSerializedTimers());
			});
			elems.buttons.minus.addEventListener('click', () => {
				const currentTimer = state.timers[state.currentTimerId];
				currentTimer.initialDuration = currentTimer.changeDurationBy(-60, currentTimer.initialDuration);
				currentTimer.reset();
				renderMainTimer();
				renderTimersList();
				saveTimers(getSerializedTimers());
			});

			// set default timer as current one and trigger initial rendering
			// of main timer (default callback)
			setCurrentTimer(0, renderMainTimer);

		};


		// Public interface
		return {
			init: init,
		};
	}());

	win.app = app;
})(document, window);
/*global app*/
app.init();
