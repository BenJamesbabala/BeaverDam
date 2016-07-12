"use strict";

function makeCustomPromise() {
    function cond() {
        return cond.promise;
    }
    cond.promise = new Promise((resolve, reject) => {
        cond.resolve = resolve;
        cond.reject = reject;
    });
    return cond;
}

/**
 * Player has the following promises:
 *     player.videoLoaded.then(() => {code to run when video is loaded})
 *     player.annotationsLoaded.then(() => {code to run when annotations are loaded})
 *     player.loaded.then(() => {code to run when video AND annotations are loaded})
 */
class Player {
    constructor($container, src, name) {
        Object.assign(this, {$container, src, name});

        // Set video props
        this.$('video').attr('src', src);
        this.video = this.$('video')[0];

        this.setVideoHandlers();

        // Promise: player.videoLoaded
        this.videoLoaded = makeCustomPromise();
        this.$('video').on("loadedmetadata", () => {
            this.initPaper();
            this.videoLoaded.resolve();
        }).on("abort", () => {
            this.videoLoaded.reject();
        });

        // Promise: player.annotationsLoaded
        this.annotationsLoaded = makeCustomPromise();
        this.loadAnnotations().then(
            this.annotationsLoaded.resolve,
            this.annotationsLoaded.reject
        );

        // Promise: player.loaded
        this.loaded = Promise.all([this.videoLoaded(), this.annotationsLoaded()]);
    }


    // Drawing helpers

    initPaper() {
        this.paper = Raphael(this.$('paper')[0], this.video.videoWidth, this.video.videoHeight);   
    }

    loadAnnotations() {
        return fetch(`/annotation/${this.name}`, {method: 'get'}).then((response) => {
            return response.json();
        }).then((json) => {
            this.things = json.map((json) => Thing.fromJson(json, this));
            return this.videoLoaded().then(() => {
                this.drawAnnotations();
                return Promise.resolve();
            });
        });
    }

    saveAnnotations() {
        var json = this.things.map(Thing.toJson);
        return fetch(`/annotation/${this.name}`, {
            headers: new Headers({'Content-Type': 'application/json'}),
            method: 'post',
            body: JSON.stringify(json),
        }).then((response) => {
            if (response.ok)
                return Promise.resolve('State saved successfully.');
            else
                return Promise.reject(`Error code ${response.status}`);
        });
    }

    drawAnnotations() {
        for (let thing of this.things) {
            thing.drawAtTime(this.video.currentTime);
        }
    }

    setupNewThing(x, y) {
        var thing = new Thing(this);
        this.things.push(thing);
        thing.drawing.setBounds({
            xMin: x,
            xMax: x,
            yMin: y,
            yMax: y,
        });
        thing.drawing.onDragStart();
    }


    // Video control helpers

    setVideoHandlers() {
        var $video = $(this.video);

        // control-play => video
        // control-pause => video
        this.$on('control-play', 'click', () => this.video.play());
        this.$on('control-pause', 'click', () => this.video.pause());

        // video <=> control-time
        this.$on('control-time', 'change', () => this.videoTime = this.controlTime);
        $video.on('timeupdate', () => this.controlTimeUnfocused = this.videoTime);

        // video <=> control-scrubber
        this.$on('control-scrubber', 'change input', () => this.videoTime = this.controlScrubber);
        $video.on('timeupdate', () => this.controlScrubberUnfocused = this.videoTime);

        // video => (annotations)
        $video.on('timeupdate', () => {
            this.drawAnnotations();
        });
    }

    get controlTime() {
        return parseFloat(this.$('control-time').val());
    }

    get controlTimeUnfocused() {
        return this.controlTime;
    }

    set controlTimeUnfocused(value) {
        this.$('control-time:not(:focus)').val(value.toFixed(2));
    }

    get controlScrubber() {
        return parseFloat(this.$('control-scrubber').val()) / 10000 * this.video.duration;
    }
    get controlScrubberUnfocused() {
        return this.controlScrubber;
    }

    set controlScrubberUnfocused(value) {
        this.$('control-scrubber:not(:focus)').val(value * 10000 / this.video.duration);
    }

    get videoTime() {
        return this.video.currentTime;
    }

    set videoTime(value) {
        this.video.currentTime = value;
    }


    // DOM/jQuery helpers

    $(selector) {
        return this.$container.find(`.player-${selector}`);
    }

    $on(selector, eventName, callback) {
        return this.$container.on(eventName, `.player-${selector}`, callback);
    }
}

void Player;
