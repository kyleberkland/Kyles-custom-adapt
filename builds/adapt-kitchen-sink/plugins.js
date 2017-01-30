/*
* adapt-contrib-article-reveal
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Stuart Nicholls <stuart@stuartnicholls.com>, Mohammed Salamat Ali <Mohammed.SalamatAli@kineo.com>
*/
define('extensions/adapt-article-reveal/js/adapt-article-reveal',[
    'core/js/adapt'
], function(Adapt) {

    var ArticleRevealView = Backbone.View.extend({

        className: "article-reveal",

        events: {
            "click .article-reveal-open-button":"revealArticle",
            "click .article-reveal-close-button":"closeArticle"
        },

        initialize: function () {
			if (this.model.get('_articleReveal') && this.model.get('_articleReveal')._isEnabled) {
				this.render();
				this.setup();
				this.listenTo(Adapt, "remove", this.remove);
				this.listenTo(Adapt, 'device:changed', this.setDeviceSize);
				Adapt.on("page:scrollTo", _.bind(this.onProgressBarScrollTo, this));
			}
        },

        render: function () {
            var data = this.model.toJSON();
            var template = Handlebars.templates["adapt-article-reveal"];
            $(this.el).html(template(data)).prependTo('.' + this.model.get("_id"));

            var incomplete = this.model.findDescendants("components").where({_isComplete:false});
            if (incomplete.length === 0) this.setOpenButtonState();

            return this;
        },

        setup: function(event) {
            if (event) event.preventDefault();
            //prevent drag on buttons
            this.preventDrag();

            //hide articles
            var $articleInner = $("." + this.model.get("_id") + " > .article-inner ");

            var incomplete = this.model.findDescendants("components").where({_isComplete:false});
            if (incomplete.length > 0){
                $articleInner.css({display:"none"});

                //hide the components inside the article
                this.toggleisVisible( false );
            }
            this.setDeviceSize();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large' || Adapt.device.screenSize === 'medium') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false);
            }
            this.render();
        },

        setOpenButtonState: function() {
            this.$(".article-reveal-open-button").addClass('visited show');
            this.$(".article-reveal-close-button").addClass('show');
        },

        setClosedButtonState: function() {
            this.$(".article-reveal-open-button").removeClass('show');
        },

        closeArticle: function(event) {
            if (event) event.preventDefault();

            this.setClosedButtonState();

            //animate Close..
            // this.$(".article-reveal-close-button").velocity("fadeOut", 500);

            //..and set components to isVisible false
            this.$el.siblings(".article-inner").velocity("slideUp", 600, _.bind(function() {
                this.toggleisVisible(false);
            }, this));
            this.$el.velocity("scroll", {
                duration: 600,
                offset: -$(".navigation").outerHeight()
            });
            this.$(".article-reveal-open-button").focus();
            this.$(".article-reveal-close-button").removeClass('show');
        },

        revealArticle: function(event) {
            if (event) event.preventDefault();
            if(this.$el.closest(".article").hasClass("locked")) return; // in conjunction with pageLocking

            this.setOpenButtonState();

            //animate reveal
            Adapt.trigger("article:revealing", this);
            this.$el.siblings(".article-inner").velocity("slideDown", 800, _.bind(function() {
                Adapt.trigger("article:revealed", this);
                // Call window resize to force components to rerender -
                // fixes components that depend on being visible for setting up layout
                $(window).resize();
            }, this));
            this.$el.velocity("scroll", {
                delay: 400,
                duration: 800,
                offset: this.$el.height() - $(".navigation").outerHeight()
            });
            // this.$(".article-reveal-close-button").velocity("fadeIn", {
            //     delay: 400,
            //     duration: 500
            // });

            //set components to isVisible true
            this.toggleisVisible(true);
        },

        /**
         * Toggles the visibility of the components inside the article
         */
        toggleisVisible: function(view) {
            var allComponents = this.model.findDescendants('components');
            allComponents.each(function(component) {
                component.setLocking("_isVisible", false);
                component.set('_isVisible', view, {
                    pluginName:"_articleReveal"
                });
            });
        },

        preventDrag: function() {
            $(".article-reveal-open-button").on("dragstart", function(event) {
                event.preventDefault();
            });
            $(".article-reveal-close-button").on("dragstart", function(event) {
                event.preventDefault();
            });
        },

        // Handles the Adapt page scrollTo event
        onProgressBarScrollTo: function(componentSelector) {
            if (typeof componentSelector == "object") componentSelector = componentSelector.selector;
            var allComponents = this.model.findDescendants('components');
            var componentID = componentSelector;
            if(componentID.indexOf('.') === 0) componentID = componentID.slice(1);
            allComponents.each(_.bind(function(component){
                if(component.get('_id') === componentID && !component.get('_isVisible')){
                    this.revealComponent(componentSelector);
                    return;
                }
            }, this));
        },

        revealComponent: function(componentSelector) {
            this.setOpenButtonState();

            this.toggleisVisible(true);

            $("." + this.model.get("_id") + " > .article-inner ").slideDown(0);

            this.$(".article-reveal-close-button").fadeIn(1);

            $(window).scrollTo($(componentSelector), {
                offset:{
                    top:-$('.navigation').height()
                }
            }).resize();
        }

    });

    Adapt.on('articleView:postRender', function(view) {
        if (view.model.get("_articleReveal")) {
            new ArticleRevealView({
                model:view.model
            });
        }
    });

});

/*
 * adapt-audio
 * License - http://github.com/cgkineo/adapt_framework/LICENSE
 */
define('extensions/adapt-audio/js/adapt-audio',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var AudioView = Backbone.View.extend({

        className: "extension-audio",

        initialize: function() {
            this.render();
            this.listenTo(Adapt, 'audio', this.onAudioInvoked);
            this.listenTo(Adapt, 'audio:stop', this.onAudioStop);

            if (Modernizr.audio) {
                this.audio = new Audio();

                $(this.audio).on('ended', _.bind(this.onAudioEnded, this));
            } else if ($("#audioPlayer")[0] == undefined) {
                this.embedFlashAudioPlayer();
            }
        },

        render: function() {
            var template = Handlebars.templates["audio"]
            this.$el.html(template()).appendTo('#wrapper');
            return this;
        },

        embedFlashAudioPlayer: function() {

            window.onFlashAudioFinished = _.bind(this.onAudioEnded, this);

            var params = {
                swliveconnect: "true",
                allowscriptaccess: "always"
            };

            var attributes = {
                id: "audioPlayer",
                name: "audioPlayer"
            };

            swfobject.embedSWF("assets/audioplayer.swf", "flashPlayer", "1", "1", "8.0.22", "assets/express_install.swf", false, params, attributes);

            console.log($("#audioPlayer")[0]);
        },

        onAudioCtrlsClick: function(event) {
            if (event) event.preventDefault();
            Adapt.trigger('audio', event.currentTarget);
        },

        play: function() {
            try {
                if (this.audio) this.audio.play();
                else {
                    $("#audioPlayer")[0].loadAudio(this.$active.data('mp3'));
                }
            } catch (e) {
                console.error("play error");
            }
        },

        pause: function() {
            try {
                if (this.audio) this.audio.pause();
                else {
                    $("#audioPlayer")[0].controlAudio("pause");
                }
            } catch (e) {
                console.error("pause error");
            }
        },

        stop: function() {
            try {
                if (this.audio) {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                } else {
                    $("#audioPlayer")[0].controlAudio("pause");
                }
            } catch (e) {
                console.error("stop error");
            }
        },

        onAudioInvoked: function(el) {
            var $el = $(el);

            if (this.$active && this.$active.is($el)) {
                if (this.$active.hasClass('play')) {
                    this.$active.addClass('pause').removeClass('play');
                    this.play();
                } else {
                    this.$active.addClass('play').removeClass('pause');
                    this.pause();
                }
            } else {
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.pause();
                }

                this.$active = $el;
                this.$active.addClass('pause').removeClass('play');

                if (Modernizr.audio) {
                    if (this.audio.canPlayType('audio/ogg')) this.audio.src = this.$active.data('ogg');
                    if (this.audio.canPlayType('audio/mpeg')) this.audio.src = this.$active.data('mp3');
                }

                this.play();
            }
        },

        onAudioEnded: function() {
            if (this.$active) {
                this.$active.addClass('play').removeClass('pause');
            }
            this.stop();
        },

        onAudioStop: function(el) {

            if (el == null || el == undefined) {
                // console.log('stop any audio currently playing');
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.stop();
                }
            } else if (this.$active && (this.$active.is(el) || this.$active.parents(el).length > 0)) {
                // console.log('stop audio for specific element/descendents if currently playing');
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.stop();
                }
            }
        }
    });


    Adapt.once("app:dataLoaded", function() {
        new AudioView();
    });

    Adapt.on('router:location', function() {
        Adapt.trigger('audio:stop');
    });

});



(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define('extensions/adapt-background-video/js/inlineVideo',['jquery'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = function( root, jQuery ) {
            if ( jQuery === undefined ) {
                // require('jQuery') returns a factory that requires window to
                // build a jQuery instance, we normalize how we use modules
                // that require this pattern but the window provided is a noop
                // if it's defined (how jquery works)
                if ( typeof window !== 'undefined' ) {
                    jQuery = require('jquery');
                }
                else {
                    jQuery = require('jquery')(root);
                }
            }
            factory(jQuery);
            return jQuery;
        };
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    if ($.fn.inlinevideo) return;

    //RAF
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = (function() {
            return window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function( callback, element ) {
                    return window.setTimeout( callback, 1000 / 60 );
                };
        })();
    }
    if (!window.cancelRequestAnimationFrame) {
        window.cancelRequestAnimationFrame = (function() {
            return window.webkitCancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.oCancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame ||
                clearTimeout;
        })();
    }

    var extend = function(a,b) {
        for (var k in b) {
            a[k] = b[k];
        }
        return a;
    };

    //APPLE iPhone/iOS Detection
    var APPLE_DETECTION = {
        initialize: function() {
            this.ua = window.navigator.userAgent.toLowerCase();
            this.isAndroid = (this.ua.match(/android/i) !== null);
            this.isiPad = (this.ua.match(/ipad/i) !== null);
            this.isiPhone = (this.ua.match(/iphone/i) !== null);
            this.isBlackBerry10 = (this.ua.match(/bb10/i) !== null);
            this.isiOS = this.isiPhone || this.isiPad;
            this.version = parseFloat(
                ('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(this.ua) || [0,''])[1])
                .replace('undefined', '3_2').replace('_', '.').replace('_', '')
            ) || false;
            delete this.initialize;

            if (APPLE_DETECTION.test) {
                APPLE_DETECTION.isAndroid = true;
                // APPLE_DETECTION.isiPhone = true;
                // APPLE_DETECTION.version = 9;
            }
        }

    };

    //INLINE VIDEO ELEMENT
    window.InlineVideo = function InlineVideo(videoElement, options) {
        var inlineVideoElement = document.createElement('inlinevideo');
        inlineVideoElement._videoElement = videoElement;
        $.extend(inlineVideoElement, InlineVideo.prototype);
        return InlineVideo.initialize.call(inlineVideoElement, options);
    };

    var uid = 0;

    extend(InlineVideo, {

        initialize: function(options) {
        
            this._uid = uid++;
            this._wasPlayClicked = false;
            this._lastTime = 0;
            this._lastTriggerTime = 0;
            this._videoElement.playbackRate = 2;
            
            // replace the video with inlineVideo element
            $(this).addClass('inlinevideocontainer');
            $(this._videoElement).addClass("inlined").replaceWith(this).removeAttr("style");
            $(this._videoElement).removeAttr("controls");
            this._$ = $(this);
            this._$.append(this._videoElement);

            if (options.mute) this.volume = 0;

            this._audioElem = document.createElement('audio');
            $(this._audioElem).removeAttr("controls");
            $(this._audioElem).attr("loop", $(this._videoElement).attr("loop"));
            $(this._audioElem).attr("mute", $(this._videoElement).attr("mute"));
            this._audioElem.src = $(this._videoElement).find("source[type='video/mp4']").attr("audio");

            var player = [this._audioElem];
            this._$.append(player);

            var __ = this;

            this._videoElement.onloadstart = function() {

            }; // fires when the loading starts
            this._videoElement.onloadedmetadata = function() { 

                __._metaLoaded = true;
                if (__._wasPlayClicked) {
                    //if meta is loaded with play click
                    __._isLoaded = true;
                    if (__.paused) return;
                    __.play();
                }

            }; //  when we have metadata about the video
            this._videoElement.onloadeddata = function() {

            }; // when we have the first frame
            this._videoElement.onprogress = function() { 

                if (!__._isLoaded) return;
                var end = __._videoElement.buffered.end(0);
                var sofar = parseFloat(((end / __._videoElement.duration) * 100));

                //add waiting icon in here
            };

            this.options = options || {};
            if (this.options.showScrubBar) {
                InlineVideo.showScrubBar.call(this);
            }

            $.fn.inlinevideo.players[this._uid] = this;

            return this;
        },

        playLoop: function() {
            var __ = this;
            var time = Date.now();
            var elapsed = (time - this._lastTime) / 1000;
            var loop = $(this._videoElement).attr("loop");

            if (this._isDestroyed) return;

            if (this.currentTime === undefined) this.currentTime = 0;

            var currentTime = this.currentTime + elapsed;

            // render
            if (elapsed >= (1/25)) {
                var outByTime = Math.abs(this._audioElem.currentTime - currentTime);
                if (outByTime > 1) {
                    //skip audio if out of sync
                    this._audioElem.currentTime = currentTime;
                }
            }

            // if we are at the end of the video stop
            //var currentTime = (Math.round(parseFloat(this._videoElement.currentTime)*10000)/10000);
            var duration = (Math.round(parseFloat(this._videoElement.duration)*10000)/10000);
            
            if (loop && currentTime >= duration) {
                this._audioElem.currentTime = 0;
                this._videoElement.currentTime = 0;
                this._lastTime = time;
                this.currentTime = 0;
                currentTime = 0;
            } else if (currentTime <= duration - 0.1) {

                //seek video
                if (elapsed >= (1/25)) {
                    this._videoElement.currentTime = currentTime;
                    this._lastTime = time;
                    this.currentTime = currentTime;
                }
            }

            var triggerElapsed = (time - this._lastTriggerTime) / 1000;
            if (triggerElapsed >= 1/4) {
                setTimeout(function() {
                    $(__).triggerHandler("timeupdate");
                    InlineVideo.updateScrubBar.call(__);
                }, 0);
                this._lastTriggerTime = time;
                this.currentTime = currentTime;
            }

            if (currentTime >= duration && !loop) {
                this.pause();
                this.currentTime = currentTime;
                $(this).triggerHandler("ended");
                InlineVideo.updateScrubBar.call(__);
                return;
            }

            this._animationRequest = requestAnimationFrame(function() {
                if (__._isDestroyed) return;
                InlineVideo.playLoop.call(__);
            });
        }

    });

    extend(InlineVideo.prototype, {

        volume: 1,

        paused: true,

        play: function(e) { 
            //console.log("played");
            //can only be run from click
            this._wasPlayClicked = true;

            if (this._metaLoaded && !this._isLoaded) {
                //if meta loaded but play not clicked
                this._videoElement.play();
                this._videoElement.pause();
                this._videoElement.currentTime = 0;
                this._isLoaded = true;
            }

            if (!this._isLoaded) {
                //meta not captured on startup, load meta data
                this._videoElement.load();

                //mske sure to play the audio on click
                if (this._audioElem.networkState !== 3 && this.volume !== 0) {
                    this._audioElem.currentTime = 0;
                    this._audioElem.play();
                    this._audioElem.pause();
                    this._audioElem.currentTime = 0;
                }
                this.paused = false;
                return;
            }

            this._lastTime = Date.now();
            var duration = (Math.round(parseFloat(this._videoElement.duration)*10000)/10000);
            if (this.currentTime >= duration) {
                this.currentTime = 0;
                this._videoElement.currentTime = 0;
                if (this._audioElem.networkState !== 3) {
                    this._audioElem.currentTime = 0;
                }
            }

            var __ = this;
            if (this._audioElem.networkState !== 3 && this.volume !== 0) {
                this._audioElem.play();
            }
            
            this._animationRequest = requestAnimationFrame(function() {
                InlineVideo.playLoop.call(__);
            });

            setTimeout(function() {
                __.paused = false;
                $(__).triggerHandler("play")
            }, 0);

        },

        pause: function() {
           // console.log("paused");
            cancelAnimationFrame(this._animationRequest);
            this._animationRequest = null;
            if (this._audioElem.networkState !== 3) {
                this._audioElem.pause();
            }
            this.paused = true;
            var __ = this;
            setTimeout(function() {
                $(__).triggerHandler("pause")
            }, 0);
        },

        setCurrentTime: function(seconds) {
            if (seconds === undefined) return;
            this._videoElement.currentTime = seconds;
            if (this._audioElem.networkState !== 3) {
                this._audioElem.currentTime = seconds;
            }
            this._lastTime = Date.now();
            this.currentTime = seconds;
        },

        mute: function() {
            this.volume = 0;
            if (this._audioElem.networkState !== 3) {
                this._audioElem.pause();
            }
        },

        unmute: function() {
            this.volume = 1;
            if (!this.paused) {
                if (this._audioElem.networkState !== 3) {
                    this._audioElem.play();
                }
            }
        },

        isPaused: function() {
            return this.paused;
        },

        getVolume: function() {
            return this.volume;
        },

        setVolume: function(int) {
            if (int < 1) this.volume = 0;
            if (int >= 1) this.volume = 1;
            if (this.volume === 0) {
                if (this._audioElem.networkState !== 3) {
                    this._audioElem.pause();
                }
            }
        },

        destroy: function() {
            this._isDestroyed = true;
            $(this._videoElement).removeClass("inlined");
            InlineVideo.removeScrubBar.call(this);
            delete $.fn.inlinevideo.players[this._uid];
        }

    });

    extend(InlineVideo, {

        _scrubBar: '<div class="inlinevideo-scrub-bar"><div class="outer"><div class="container"><div class="inner" style="width:0px;"></div></div></div></div>',

        showScrubBar: function() {
            this._$scrubBar = $(InlineVideo._scrubBar);
            $(this).append(this._$scrubBar);
            this._$scrubBar.find(".container").attr("data-player", this._uid).on("click", InlineVideo.clickScrubBar);
        },

        clickScrubBar: function(e) {
            e.preventDefault();
            e.stopPropagation();

            var $container = $(e.currentTarget);

            var playerid = $container.attr("data-player");
            var player = $.fn.inlinevideo.players[playerid];

            var position = $container.offset();
            var clientX = e.clientX;
            switch (e.type) {
            case "touchstart":
            case "touchmove":
            case "touchend":
                if (e.originalEvent.changedTouches) {
                    clientX = e.originalEvent.changedTouches[0].clientX;
                } else {
                    clientX = e.originalEvent.layerX;
                }
            }

            var leftPX = (clientX - position.left);
            var barWidth = $container.width();

            var markSeconds = player._videoElement.duration;
            var passedSeconds = player.currentTime;

            var gotoSeconds = (leftPX/barWidth) * markSeconds;

            player.setCurrentTime(gotoSeconds);
        },

        updateScrubBar: function() {
            if (!this._$scrubBar) return;
            var width = (100 / this._videoElement.duration) * this._videoElement.currentTime;
            this._$scrubBar.find(".inner").css("width", width+"%");
        },

        removeScrubBar: function() {
            if (!this._$scrubBar) return;
            this._$scrubBar.find(".container").off("click", InlineVideo.clickScrubBar);
        }

    });

    extend(InlineVideo.prototype, {

        _$scrubBar: null

    });

    //Inline video styling
    var injectStyling = function() {
        //hide user controls
        if(!$("style.inlinevideo").length) {
            var css = [
                ".inlinevideo-scrub-bar { position: absolute; top:auto; bottom: 0; left: 0; right: 0; height: 28px; }",
                ".inlinevideo-scrub-bar .outer { opacity: 1; transition: opacity 1s; -webkit-transition: opacity 1s; background: black; position: absolute; top: 0; left: 0; padding: 9px 5px; bottom: 0; right: 0; }",
                ".inlinevideo-scrub-bar .container { height:100%; background: #333; background: rgba(50, 50, 50, 0.8); background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(rgba(30, 30, 30, 0.8)), to(rgba(60, 60, 60, 0.8))); background: -webkit-linear-gradient(top, rgba(30, 30, 30, 0.8), rgba(60, 60, 60, 0.8)); background: -moz-linear-gradient(top, rgba(30, 30, 30, 0.8), rgba(60, 60, 60, 0.8)); background: -o-linear-gradient(top, rgba(30, 30, 30, 0.8), rgba(60, 60, 60, 0.8)); background: -ms-linear-gradient(top, rgba(30, 30, 30, 0.8), rgba(60, 60, 60, 0.8)); background: linear-gradient(rgba(30, 30, 30, 0.8), rgba(60, 60, 60, 0.8)); border-radius: 2px; cursor: pointer; }",
                ".inlinevideo-scrub-bar .inner {background: #fff; background: rgba(255, 255, 255, 0.8); background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(rgba(255, 255, 255, 0.9)), to(rgba(200, 200, 200, 0.8))); background: -webkit-linear-gradient(top, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.8)); background: -moz-linear-gradient(top, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.8)); background: -o-linear-gradient(top, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.8)); background: -ms-linear-gradient(top, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.8)); background: linear-gradient(rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.8)); width:0%; height:100%; }",
                "inlinevideo { display:inline-block; position:relative; } inlinevideo video {width:100%;height:auto;} inlinevideo audio {display:none;} video.inlined::-webkit-media-controls {display: none !important;} video.inlined::-webkit-media-controls-start-playback-button { display: none !important;-webkit-appearance: none;}"
            ];

            $("head").append("<style class='inlinevideo'>"+css.join(" ")+"</style>");
        }
    };

    $.fn.inlinevideo = function(options) {
        if (!((APPLE_DETECTION.isiPhone && APPLE_DETECTION.version > 8) || true)) return false;
        
        var $this = $(this);
        var $items = $([]);

        $items = $items.add($this.find("video:not(.inlined)"));
        $items = $items.add($this.filter("video:not(.inlined)"));

        $items.each(function(index, item) {

            injectStyling();
            
            $(item).addClass("inlinevideo");

            var inlineVideo = new InlineVideo(item, options);
            if (typeof options.success === "function") options.success(inlineVideo, options);

        });



        return true;
    };
    $.fn.inlinevideo.players = {};

    APPLE_DETECTION.test = false;
    APPLE_DETECTION.initialize();

    extend($.fn.inlinevideo, APPLE_DETECTION);

}));

define('extensions/adapt-background-video/js/video',[
    "./inlineVideo"
], function() {

    var mep_defaults = {
        "poster": "",
        "showPosterWhenEnded": false,
        "defaultVideoWidth": 480,
        "defaultVideoHeight": 270,
        "videoWidth": -1,
        "videoHeight": -1,
        "defaultAudioWidth": 400,
        "defaultAudioHeight": 30,
        "defaultSeekBackwardInterval": "(media.duration * 0.05)",
        "defaultSeekForwardInterval": "(media.duration * 0.05)",
        "audioWidth": -1,
        "audioHeight": -1,
        "startVolume": 1,
        "loop": true,
        "autoRewind": true,
        "enableAutosize": true,
        "alwaysShowHours": false,
        "showTimecodeFrameCount": false,
        "framesPerSecond": 12.5,
        "autosizeProgress" : true,
        "alwaysShowControls": false,
        "hideVideoControlsOnLoad": true,
        "clickToPlayPause": false,
        "iPadUseNativeControls": false,
        "iPhoneUseNativeControls": false,
        "AndroidUseNativeControls": false,
        "features": [],
        "isVideo": true,
        "enableKeyboard": true,
        "pauseOtherPlayers": false,
        "startLanguage": "",
        "tracksText": "",
        "hideCaptionsButtonWhenEmpty": true,
        "toggleCaptionsButtonWhenOnlyOne": false,
        "slidesSelector": ""
    };

    var uid = 0;

    var tagpool = [];
    var poolUid = 0;
    var attributes = [ "preload", "poster", "width", "height", "style", "src", "controls", "loop" ];


    var Video = Backbone.View.extend({

        fromPool: false,
        ratioHeight: 9,
        ratioWidth: 16,

        className: function() {
            return "video-widget a11y-ignore-aria";
        },

        initialize: function(options) {
            this.uid = uid++;
            this.preRender();
            this.render();
            _.defer(_.bind(function() {
                this.postRender();
            }, this));

            this.setupRatio();
        },

        setupRatio: function() {

            var ratio = "16:9";
            if (this.model.get("_ratio")) ratio = this.model.get("_ratio");
            
            var colonIndex = ratio.indexOf(":");

            this.ratioWidth = parseFloat( ratio.substr(0, colonIndex) );
            this.ratioHeight = parseFloat( ratio.substr(colonIndex+1, ratio.length) );
            
        },

        preRender: function() {
            var speed = "fast";
            if (speedtest) speed = speedtest.low_name;

            var isAndroid = $.fn.inlinevideo.isAndroid;
            var isiOS = $.fn.inlinevideo.isiOS;
            if (isAndroid || isiOS) {
                //force android and ios to use lower quality videos
                //this is to limit the amount of memoery required
                console.log("Forcing low quality videos");
                speed = "slow";
            }
            this.model.get("_media").extension = "mp4";
            if (isAndroid) {
                console.log("Forcing webm videos");
                this.model.get("_media").extension = "webm";
            }

            this.model.set("speed", speed);
        },

        render: function() {
            var template = Handlebars.templates[this.constructor.template];
            var output = template(this.model.toJSON());
            this.$el.html(output);
        },

        postRender: function() {
            if ($.fn.inlinevideo.isiPad || $.fn.inlinevideo.isAndroid) {
                //force ipads to reuse video tags 
                //ipads have a 16 tag play limit before they need to be reused
                //TODO: this needs to be extended into the track rendering and playing
                //maximum two tracks rendered
                if (tagpool.length > 0) {
                    this.fromPool = true;
                    var $reused = tagpool.pop();
                    console.log("not fresh", $reused);
                    for (var i = 0, l = attributes.length; i < l; i++) {
                        var attr = attributes[i];
                        $reused.removeAttr(attr);
                    }
                    $reused.html("").append(this.$("video").children());
                    var $unused = this.$("video");
                    for (var i = 0, l = attributes.length; i < l; i++) {
                        var attr = attributes[i];
                        $reused.attr(attr, $unused.attr(attr));
                    }
                    $unused.replaceWith($reused);
                    $reused.removeAttr("mute");
                    console.log("reuse", $reused[0].poolUid);
                } else {
                    console.log("fresh", this.$("video"));
                }
            }

            this.setupPlayer();
        },

        setupPlayer: function() {
            if (!this.model.get('_playerOptions')) this.model.set('_playerOptions', {});

            var modelOptions = _.extend({}, mep_defaults);

            modelOptions.pluginPath = 'assets/';

            if (this.model.get("features")) modelOptions.features = this.model.get("features");

            modelOptions.success = _.bind(this.onPlayerReady, this);

            if (this.model.get('_autoRewind')) {
                modelOptions.autoRewind = true;
            }

            if (this.model.get('_alwaysShowControls')) {
                modelOptions.alwaysShowControls = true;
            }

            if (this.model.get('loop')) {
                modelOptions.loop = true;
            }

            if (this.model.get('mute')) {
                modelOptions.startVolume = 0;
                modelOptions.volume = 0;
            }

            if (this.model.get('_useClosedCaptions')) {
                modelOptions.startLanguage = this.model.get('_startLanguage') === undefined ? 'en' : this.model.get('_startLanguage');
            }

            this.addMediaTypeClass();

            // create the player
            this.$('video').mediaelementplayer(modelOptions);

            // We're streaming - set ready now, as success won't be called above
            if (this.model.get('_media').source) {
                this.$('.media-widget').addClass('external-source');
                this.setReadyStatus();
            }
        },

        addMediaTypeClass: function() {
            var media = this.model.get("_media");
            if (media.type) {
                var typeClass = media.type.replace(/\//, "-");
                this.$(".media-widget").addClass(typeClass);
            }
        },

        setupEventListeners: function() {
            this.videoElement.addEventListener("start", _.bind(this.onEventFired, this));
            this.videoElement.addEventListener("play", _.bind(this.onEventFired, this));
            this.videoElement.addEventListener("ended", _.bind(this.onEventFired, this));
            this.videoElement.addEventListener('timeupdate', _.bind(this.onEventFired, this));
        },

        onEventFired: function(e) {
            if (this.isRemoved) return;
            switch (e.type) {
            case "timeupdate":
                if (this.model.get("mute")) this.videoElement.setVolume(0);
                var currentSeconds = Math.ceil(this.videoElement.currentTime*10)/10;
                if (this.triggerSeconds !== currentSeconds) {
                    //console.log("seconds videoElement", this.uid, currentSeconds);
                    this.trigger("seconds", this, currentSeconds);
                    this.triggerSeconds = currentSeconds
                }
                break;
            case "ended":
                if ($("html").is(".iPhone")) {
                    this.$("video")[0].webkitExitFullScreen();
                }
                this.trigger("finish", this);
                break;
            case "play":
                this.trigger("play", this);
                break;
            default:
                debugger;
            }
        },

        play: function(seekTo) {
            if (!this.videoElement) return;
            if (this.$("video")[0].poolUid === undefined) {
                this.$("video")[0].poolUid = poolUid++;
            }
            console.log("playing", this.$("video")[0].poolUid);
            this.setCurrentSeconds(seekTo, true);
            this.hasPlayed = true;
            this.videoElement.pause();
            this.videoElement.play();
            this.setCurrentSeconds(seekTo, true);
            console.log("videoElement", this.uid, "played");
            if (this.model.get("mute")) this.videoElement.setVolume(0);

            if (this.model.get('_alwaysShowControls')) {
                this.videoElement.player.showControls();
                this.$(".mejs-controls").css("display", "block");
            }
        },

        setCurrentSeconds: function(seekTo) {
            if (!this.videoElement) return;
            if (seekTo === undefined) return;
            try {
                this.videoElement.player.setCurrentTime(seekTo);
            } catch(e) {}
        },

        pause: function() {
            if (!this.videoElement) return;
            console.log("videoElement", this.uid, "paused");
            this.videoElement.pause();
            if ($("html").is(".iPhone")) {
                this.$("video")[0].webkitExitFullScreen();
            }
        },

        mute: function() {
            if (!this.videoElement) return;
            this.videoElement.setVolume(0);
        },

        unmute: function() {
            if (!this.videoElement) return;
            this.videoElement.setVolume(1);
        },

        isPaused: function() {
            if (!this.videoElement) return;
            return this.videoElement.paused;
        },

        getVolume: function() {
            if (!this.videoElement) return;
            return this.videoElement.volume;
        },

        setVolume: function(int) {
            if (!this.videoElement) return;
            this.videoElement.setVolume(int);
        },

        hasVolume: function() {
            return true;
        },

        remove: function() {
            this.isRemoved = true;
            if ($.fn.inlinevideo.isiPad || $.fn.inlinevideo.isAndroid) {
                if (this.$("video")[0].poolUid !== undefined) {
                    tagpool.push(this.$("video"));
                    console.log("pooling", this.$("video")[0].poolUid);
                }               
            }

            this.videoElement.player.remove();
            if ($("html").is(".ie8")) {
                var obj = this.$("object")[0];
                if (obj) {
                    obj.style.display = "none";
                }
            }
            if (this.videoElement) {
                $(this.videoElement.pluginElement).remove();
                delete this.videoElement;
            }
            Backbone.View.prototype.remove.call(this);
        },

        onPlayerReady: function (videoElement, domObject) {
            this.videoElement = videoElement;

            if (!this.videoElement.player) {
                this.videoElement.player =  mejs.players[this.$('.mejs-container').attr('id')];
            }

            if (this.model.get('_alwaysShowControls')) {
                this.videoElement.player.showControls();
                this.$(".mejs-controls").css("display", "block");
            }

            this.setupEventListeners();

            this.trigger("ready", this);
        },

        resize: function($parent) {

            var width = $parent.width(), height= $parent.height();

            var videoRatio  = this.ratioWidth / this.ratioHeight;
            var parentRatio = width / height;

            var isWiderRatio = (videoRatio <= parentRatio);

            this.$el.css({
                width: "",
                height: ""
            });

            _.defer(_.bind(function() {
                if (isWiderRatio) {
                    var forceHeight = width / videoRatio;
                    var topOffset = -((forceHeight - height) / 2)
                    this.$el.css({
                        width: width,
                        height: forceHeight,
                        top: topOffset,
                        left: 0
                    });
                    this.$(".mejs-container, object").css({
                        width: width,
                        height: forceHeight,
                    })
                } else {
                    var forceWidth = height * videoRatio;
                    var leftOffset = -((forceWidth - width) / 2)
                    this.$el.css({
                        width: forceWidth,
                        height: height,
                        left: leftOffset,
                        top: 0
                    });    
                    this.$(".mejs-container, object").css({
                        width: forceWidth,
                        height: height,
                    })
                }
            }, this));
            
        }

    },{
        template: "background-video"
    });

    return Video;

});

define('extensions/adapt-background-video/js/iPhoneVideo',[],function() {

    var uid = 0;

    var tagpool = [];
    var poolUid = 0;
    var attributes = [ "preload", "poster", "width", "height", "style", "src", "controls", "loop" ];

    var Video = Backbone.View.extend({

        volume: 1,

        className: function() {
            return "video-widget a11y-ignore-aria";
        },

        initialize: function(options) {
            this.uid = uid++;

            this.preRender();
            this.render();
            _.defer(_.bind(function() {
                this.postRender();
            }, this));

            this.setupRatio();
        },

        setupRatio: function() {

            var ratio = "16:9";
            if (this.model.get("_ratio")) ratio = this.model.get("_ratio");
            
            var colonIndex = ratio.indexOf(":");

            this.ratioWidth = parseFloat( ratio.substr(0, colonIndex) );
            this.ratioHeight = parseFloat( ratio.substr(colonIndex+1, ratio.length) );
            
        },

        preRender: function() {
            var speed = "fast";
            if (speedtest) speed = speedtest.low_name;
            var isiPhone = $.fn.inlinevideo.isiPhone;
            var isiOS = $.fn.inlinevideo.isiOS;
            this.model.get("_media").extension = "mp4";
            if (isiPhone || isiOS) {
                console.log("Forcing low quality videos");
                speed = "slow";
            }

            this.model.set("speed", speed);
        },

        render: function() {
            var template = Handlebars.templates[this.constructor.template];
            var output = template(this.model.toJSON());
            this.$el.html(output);
        },

        postRender: function() {
            if (tagpool.length > 0) {
                this.fromPool = true;
                var $reused = tagpool.pop();
                console.log("not fresh", $reused);
                for (var i = 0, l = attributes.length; i < l; i++) {
                    var attr = attributes[i];
                    $reused.removeAttr(attr);
                }
                $reused.html("").append(this.$("video").children());
                var $unused = this.$("video");
                for (var i = 0, l = attributes.length; i < l; i++) {
                    var attr = attributes[i];
                    $reused.attr(attr, $unused.attr(attr));
                }
                $unused.replaceWith($reused);
                $reused.removeAttr("mute");
                console.log("reuse", $reused[0].poolUid);
            } else {
                console.log("fresh", this.$("video"));
            }

            this.setupPlayer();
        },

        setupPlayer: function() {

            var modelOptions = {};
            modelOptions.success = _.bind(this.onPlayerReady, this);
            modelOptions.showScrubBar = false;
            modelOptions.mute = this.model.get("mute");
            modelOptions.loop = this.model.get("loop");

            // create the player
            this.$('video').inlinevideo(modelOptions);
        },

        setupEventListeners: function() {
            $(this.videoElement).on("play", _.bind(this.onEventFired, this));
            $(this.videoElement).on("ended", _.bind(this.onEventFired, this));
            $(this.videoElement).on('timeupdate', _.bind(this.onEventFired, this));
        },

        onEventFired: function(e) {
            if (this.isRemoved) return;
            switch (e.type) {
            case "timeupdate":
                var currentSeconds = Math.ceil(this.videoElement.currentTime*10)/10;
                if (this.triggerSeconds !== currentSeconds) {
                    //console.log("seconds iPhoneVideoElement", this.uid, currentSeconds);
                    this.trigger("seconds", this, currentSeconds);
                    this.triggerSeconds = currentSeconds
                }
                break;
            case "ended":
                this.trigger("finish", this);
                break;
            case "play":
                this.trigger("play", this);
                break;
            default:
                debugger;
            }
        },

        play: function(seekTo) {
            if (this.$("video")[0].poolUid === undefined) {
                this.$("video")[0].poolUid = poolUid++;
            }
            this.setCurrentSeconds(seekTo);
            this.hasPlayed = true;
            this.videoElement.play();
        },

        setCurrentSeconds: function(seekTo) {
            this.videoElement.setCurrentTime(seekTo);
        },

        pause: function() {
            this.videoElement.pause()
        },

        mute: function() {
            this.videoElement.setVolume(0);
        },

        unmute: function() {
            this.videoElement.setVolume(1);
        },

        isPaused: function() {
            return this.videoElement.paused;
        },

        getVolume: function() {
            return this.volume;
        },

        setVolume: function(int) {
            this.volume = int;
            if (this.volume < 1) this.volume = 0;
            if (this.volume >= 1) this.volume = 1;
            this.videoElement.setVolume(this.volume);
        },

        remove: function() {
            this.isRemoved = true;
            if (this.$("video")[0].poolUid !== undefined) {
                tagpool.push(this.$("video"));
                console.log("pooling", this.$("video")[0].poolUid);
            }

            if (this.videoElement) {
                this.videoElement.destroy();
                $(this.videoElement).remove();
                delete this.videoElement;
            }
            Backbone.View.prototype.remove.call(this);
        },

        onPlayerReady: function (videoElement) {
            this.videoElement = videoElement;

            this.setupEventListeners();

            this.trigger("ready", this);
        },

        resize: function($parent) {

            var width = $parent.width(), height= $parent.height();

            var videoRatio  = this.ratioWidth / this.ratioHeight;
            var parentRatio = width / height;

            var isWiderRatio = (videoRatio <= parentRatio);

            this.$el.css({
                width: "",
                height: ""
            });

            _.defer(_.bind(function() {
                if (isWiderRatio) {
                    var forceHeight = width / videoRatio;
                    var topOffset = -((forceHeight - height) / 2)
                    this.$el.css({
                        width: width,
                        height: forceHeight,
                        top: topOffset,
                        left: 0
                    });
                    this.$("inlinevideo").css({
                        width: width,
                        height: forceHeight,
                    })
                } else {
                    var forceWidth = height * videoRatio;
                    var leftOffset = -((forceWidth - width) / 2)
                    this.$el.css({
                        width: forceWidth,
                        height: height,
                        left: leftOffset,
                        top: 0
                    });    
                    this.$("inlinevideo").css({
                        width: forceWidth,
                        height: height,
                    })
                }
            }, this));
            
        }

    },{
        template: "background-video"
    });


    return Video;

});

define('extensions/adapt-background-video/js/container',[
	'core/js/adapt',
	'./video',
	'./iPhoneVideo',
	'handlebars'
], function(Adapt, Video, IPhoneVideo, Handlebars) {

	$("body").on("mousedown touchstart", function() {
		Adapt.trigger("clickjack");
	});

	var Container = Backbone.View.extend({

		videos: null,

		initialize: function() {
			this.videos = {};
			this.setUpEventListeners();
			this.render();
		},

		setUpEventListeners: function() {
			this.resize = _.debounce(_.bind(this.resize, this), 17);
			this.listenTo(Adapt, "device:resize", this.resize);
			this.listenTo(Adapt, "clickjack", this.onClickJack);
		},

		render: function() {
			var template = Handlebars.templates['background-video-container'];
			this.$el.append(template());
		},

		resize: function() {
			for (var k in this.videos) {
				var video = this.videos[k];
				video.resize(this.$el);
			}
		},

		className: function() {
			return "background-video-container";
		},

		add: function(options) {
			if (!options) return;

			options.loop = true;
			options.mute = true;
			options.showScrubBar = false;

			var video;

			if ($.fn.inlinevideo.isiOS || $("html").is(".Safari")) {
				video = new IPhoneVideo({
					model: new Backbone.Model(options),
					$parent: this.$el
				});
			} else {
				video = new Video({
					model: new Backbone.Model(options),
					$parent: this.$el
				});
			}

			this.videos[options.name] = video;

			this.$(".background-video-inner").append(video.$el);

			video.resize(this.$el);

			this.listenTo(video, "ready", this.onVideoReady);
			this.listenTo(video, "seconds", this.onVideoTick);
		},

		play: function(videoName) {
			if (!this.videos[videoName]) return;

			var video = this.videos[videoName];
			if (video.hasPlayed || this.isReady) {
				this.tryPlay(video);
			} else {
				video.playWhenReady = true;
			}

		},

		pause: function(videoName) {
			if (!this.videos[videoName]) return;

			var video = this.videos[videoName];
			video.pause();
		},

		onVideoReady: function(video) {
			if (video.playWhenReady) {
				this.tryPlay(video);
			}
			this.isReady = true;
			this.trigger("ready");
		},

		onVideoTick: function(video, seconds) {
			this.trigger("tick", video, seconds);
		},

		tryPlay: function(video) {
			//try {
				video.shouldBePlaying = true;
				_.defer(function() {
					video.play(0);
				});
			//} catch(e) {
				//alert(e);	
			//}
		},

		onClickJack: function() {
			for (var k in this.videos) {
				var video = this.videos[k];
				if (video.shouldBePlaying) {
					video.play();
					video.shouldBePlaying = false;
				}
			}
		},

		clear: function() {
			for (var k in this.videos) {
				var video = this.videos[k];
				video.remove();
				delete this.videos[k];
			}
		},

		remove: function() {
			this.clear();
			Backbone.View.prototype.remove.call(this);
		}


	},{
		template: "background-video-container"
	});

	return Container;

});
define('extensions/adapt-background-video/js/adapt-background-video',[
	'./container'
], function(Container) {

	var container = new Container();

    window.BackgroundVideoContainer = Container;

});

define('extensions/adapt-backgroundVideo/js/backgroundVideoView',[
    'coreJS/adapt',
    'coreViews/componentView'
], function(Adapt, ComponentView) {

    var BackgroundVideoView = Backbone.View.extend({
        el: function() {
            return Handlebars.templates['backgroundVideo'](this.model.toJSON());
        },
    });
    return BackgroundVideoView;
});

define('extensions/adapt-backgroundVideo/js/adapt-backgroundVideo',[
    "coreJS/adapt",
    './backgroundVideoView'
], function(Adapt, BackgroundVideoView) {

    Adapt.on('blockView:postRender', function(view) {
        var model = view.model;
        var theme = model.get("_theme");
        if (theme && theme._backgroundVideo) {
            view.$el.addClass('backgroundVideo').prepend(new BackgroundVideoView({ model: model }).$el);
        }

    });
});

/*
 * adapt-contrib-tutor
 * License - http://github.com/adaptlearning/adapt_framework/blob/master/LICENSE
 * Maintainers - Kevin Corry <kevinc@learningpool.com>, Daryl Hedley <darylhedley@hotmail.com>,
 *               Himanshu Rajotia <himanshu.rajotia@exultcorp.com>
 */
define('extensions/adapt-component-animate/js/adapt-component-animate',[
    'coreJS/adapt'
],function(Adapt) {

    Adapt.on('componentView:preRender', function(view) {
        var model = view.model;
        if (!model.get("_componentAnimate") || model.get("_componentAnimate")._isEnabled === false ) return;
        setupView(view);

    });

    function setupView(view) {
        view.$el.css({
            "visibility": "hidden"
        });

        var config = view.model.get("_componentAnimate");

        if (!config._start) return;
        view.$el.velocity(config._start, { duration: 0 });
    }

    Adapt.on('componentView:postRender', function(view) {

        var model = view.model;
        if (!model.get("_componentAnimate") || model.get("_componentAnimate")._isEnabled === false ) return;

        view._animateOnscreen =  _.bind(onscreen, this, view);
        view.$el.on("onscreen", view._animateOnscreen);
    
    });

    function onscreen(view, event, measurements) {
        var config = view.model.get("_componentAnimate");
        config._startHeight = config._startHeight || 50;
        if (measurements.percentFromTop > config._startHeight) return;
        animateView(view);
    }

    function animateView(view) {

        var config = view.model.get("_componentAnimate");
        view.$el.off("onscreen", view._animateOnscreen);

        config._options = config._options || {};

        config._options.begin = function() {
            view.$el.css({
                "visibility": "visible"
            });
        };

        view.$el.velocity(config._command, config._options);

    }

});

define('extensions/adapt-contrib-assessment/js/adapt-assessmentArticleView',[
    'coreJS/adapt',
    'coreViews/articleView'
], function(Adapt, AdaptArticleView) {

    var AssessmentView = {

        postRender: function() {
            AdaptArticleView.prototype.postRender.call(this);
            if (this.model.isAssessmentEnabled()) {
                this._setupEventListeners();

                var config = this.model.getConfig();
                if (config && config._questions && config._questions._canShowMarking === false) {
                    this.$el.addClass('no-marking');
                }
            }
            this.$el.addClass('assessment');
        },

        _setupEventListeners: function() {
            this.listenTo(Adapt, "assessments:complete", this._onAssessmentComplete);
            this.listenTo(Adapt, "assessments:reset", this._onAssessmentReset);
            this.listenTo(Adapt, "remove", this._onRemove);
        },

        _removeEventListeners: function() {
            this.stopListening(Adapt, "assessments:complete", this._onAssessmentComplete);
            this.stopListening(Adapt, "assessments:reset", this._onAssessmentReset);
        },

        _onAssessmentComplete: function(state, model) {
            if (state.id != this.model.get("_assessment")._id) return;

            console.log("assessment complete", state, model);

        },

        _onAssessmentReset: function(state, model) {
            if (state.id != this.model.get("_assessment")._id) return;

            console.log("assessment reset", state, model);

        },

        _onRemove: function() {
            this._removeEventListeners();
        }

    };

    return AssessmentView;

});

define('extensions/adapt-contrib-assessment/js/adapt-assessmentQuestionBank',['require'],function(require) {
    
    var QuestionBank = function(quizBankid, articleId, numQuestionBlocks, uniqueQuestions) {

        this._id = quizBankid;
        this._articleId = articleId;
        this._numQuestionBlocks = numQuestionBlocks;
        this._uniqueQuestions = uniqueQuestions;
        this.questionBlocks = [];
        this.unUsedQuestionBlocks = undefined;
        this.usedQuestionBlocks = [];

    };

    QuestionBank.prototype = {

        getID: function() {
            return this._id;
        },

        addBlock: function(block) {
            this.questionBlocks.push(block);
        },

        getRandomQuestionBlocks: function() {
            this.checkResetUnunsedBlocks();

            var questionBlocks = [];
            var usedQuestionBlocks = this.usedQuestionBlocks.slice(0);

            for (var i = 0; i < this._numQuestionBlocks; i++) {
                var question = this.getRandomQuestion();
                if (question !== undefined) {
                    questionBlocks.push(question);
                } else {
                    if (usedQuestionBlocks.length === 0) break;
                    var index = Math.floor(Math.random() * (usedQuestionBlocks.length-1));
                    question = usedQuestionBlocks.splice(index,1)[0];
                    questionBlocks.push(question);
                }
            }
                
            return questionBlocks;
        },

        checkResetUnunsedBlocks: function() {
            if (this.unUsedQuestionBlocks !== undefined && this._uniqueQuestions) return;
            
            this.unUsedQuestionBlocks = this.questionBlocks.slice(0);
        },

        getRandomQuestion: function() {
            if (this.unUsedQuestionBlocks !== undefined && this.unUsedQuestionBlocks.length < 1) {
               console.warn("assessment:"+this._articleId+" No more unique questions for _assessment._quizBankID " + this._id);
               return undefined;
            }

            var index = Math.round(Math.random() * (this.unUsedQuestionBlocks.length-1));
            var questionBlock = this.unUsedQuestionBlocks[index];
            this.usedQuestionBlocks.push(questionBlock);

            this.unUsedQuestionBlocks.splice(index, 1);

            return questionBlock;
        }
        
    };

    return QuestionBank;

});
define('extensions/adapt-contrib-assessment/js/adapt-assessmentArticleModel',[
    'coreJS/adapt',
    './adapt-assessmentQuestionBank'
], function(Adapt, QuestionBank) {


    var givenIdCount = 0;
    var assessmentConfigDefaults = {
        "_isEnabled":true,
        "_questions": {
            "_resetType": "soft",
            "_canShowFeedback": false,
            "_canShowMarking": false,
            "_canShowModelAnswer": false
        },
        "_isPercentageBased" : true,
        "_scoreToPass" : 100,
        "_includeInTotalScore": true,
        "_assessmentWeight": 1,
        "_isResetOnRevisit": true,
        "_reloadPageOnReset": true,
        "_attempts": "infinite"
    };

    var AssessmentModel = {

    //Private functions

        _postInitialize: function() {
            if (!this.isAssessmentEnabled()) return;

            var assessmentConfig = this.getConfig();

            _.extend(this, {
                '_currentQuestionComponents': null,
                "_originalChildModels": null,
                "_questionBanks": null,
                "_forceResetOnRevisit": false
            });

            var attemptsLeft;
            switch (assessmentConfig._attempts) {
                case "infinite": case 0: case undefined: case -1: case null:
                     attemptsLeft = "infinite";
                    break;
                default:
                    attemptsLeft = assessmentConfig._attempts;
                    break;
            }


            //if assessment passed required and assessment included in total
            //set attemptsleft to infinite
            var centralAssessmentState = Adapt.assessment.getState();

            if (assessmentConfig._includeInTotalScore &&
                centralAssessmentState.requireAssessmentPassed) {
                attemptsLeft = "infinite";
            }

            this.set({
                '_currentQuestionComponentIds': [],
                '_assessmentCompleteInSession': false,
                '_attemptInProgress': false,
                "_isAssessmentComplete": false,
                '_numberOfQuestionsAnswered': 0,
                '_lastAttemptScoreAsPercent': 0,
                "_attempts": attemptsLeft,
                "_attemptsLeft": attemptsLeft,
                "_attemptsSpent": 0
            });

            this.listenToOnce(Adapt, "app:dataReady", this._onDataReady);
            this.listenTo(Adapt, "remove", this._onRemove);

        },

        init: function() {
            //save original children
            this._originalChildModels = this.getChildren().models;
            //collect all question components
            this._currentQuestionComponents = this.findDescendants("components").where({_isQuestionType: true});
            var currentQuestionsCollection = new Backbone.Collection(this._currentQuestionComponents);
            this.set("_currentQuestionComponentIds", currentQuestionsCollection.pluck("_id"));

            this._setAssessmentOwnershipOnChildrenModels();

        },

        _setAssessmentOwnershipOnChildrenModels: function() {
            //mark all children components as belonging to an assessment
            for (var i = 0, l = this._originalChildModels.length; i < l; i++) {
                var blockModel = this._originalChildModels[i];
                blockModel.set({
                    _isPartOfAssessment: true
                });
                //make sure components are set to _isPartOfAssessment for plp checking
                blockModel.setOnChildren({
                    _isPartOfAssessment: true
                });
            }
        },
        

        _onDataReady: function() {
            //register assessment
            Adapt.assessment.register(this);
        },

        _setupAssessmentData: function(force) {
            var assessmentConfig = this.getConfig();
            var state = this.getState();
            var shouldResetAssessment = (!this.get("_attemptInProgress") && !state.isPass)
                                || force == true;

            var quizModels;
            if (shouldResetAssessment) {
                this.set("_numberOfQuestionsAnswered", 0);
                this.set("_isAssessmentComplete", false);
                this.set("_assessmentCompleteInSession", false);
                this.set("_score", 0);
                this.getChildren().models = this._originalChildModels;
                if(assessmentConfig._banks && 
                        assessmentConfig._banks._isEnabled && 
                        assessmentConfig._banks._split.length > 1) {

                    quizModels = this._setupBankedAssessment();
                } else if(assessmentConfig._randomisation && 
                        assessmentConfig._randomisation._isEnabled) {

                    quizModels = this._setupRandomisedAssessment();
                }
            }

            if (!quizModels) {
                // leave the order as before, completed or not
                quizModels = this.getChildren().models;
            } else if ( quizModels.length === 0 ) {
                quizModels = this.getChildren().models;
                console.warn("assessment: Not enough unique questions to create a fresh assessment, using last selection");
            }

            this.getChildren().models = quizModels;

            this._currentQuestionComponents = this.findDescendants('components').where({_isQuestionType: true});
            var currentQuestionsCollection = new Backbone.Collection(this._currentQuestionComponents);
            this.set("_currentQuestionComponentIds", currentQuestionsCollection.pluck("_id"));

            var shouldResetQuestions = (assessmentConfig._isResetOnRevisit !== false && !state.isPass) 
                                        || force == true;

            if (shouldResetAssessment || shouldResetQuestions) {
                this._resetQuestions();
                this.set("_attemptInProgress", true);
                Adapt.trigger('assessments:reset', this.getState(), this);
            }
            
            if (!state.isComplete) {
                this.set("_attemptInProgress", true);
            }
            
            this._overrideQuestionComponentSettings();
            this._setupQuestionListeners();
            this._checkNumberOfQuestionsAnswered();
            this._updateQuestionsState();

            Adapt.assessment.saveState();

        },

        _setupBankedAssessment: function() {
            var assessmentConfig = this.getConfig();

            this._setupBanks();

            //get random questions from banks
            var questionModels = [];
            for (var bankId in this._questionBanks) {
                var questionBank = this._questionBanks[bankId];
                var questions = questionBank.getRandomQuestionBlocks();
                questionModels = questionModels.concat(questions);
            }

            //if overall question order should be randomized
            if (assessmentConfig._banks._randomisation) {
                questionModels = _.shuffle(questionModels);
            }

            return questionModels;
        },

        _setupBanks: function() {
            var assessmentConfig = this.getConfig();
            var banks = assessmentConfig._banks._split.split(",");

            this._questionBanks = [];

            //build fresh banks
            for (var i = 0, l = banks.length; i < l; i++) {
                var bank = banks[i];
                var bankId = (i+1);
                var questionBank = new QuestionBank(bankId, 
                                                this.get("_id"), 
                                                bank, 
                                                true);

                this._questionBanks[bankId] = questionBank;
            }

            //add blocks to banks
            var children = this.getChildren().models;
            for (var i = 0, l = children.length; i < l; i++) {
                var blockModel = children[i];
                var blockAssessmentConfig = blockModel.get('_assessment');
                var bankId = blockAssessmentConfig._quizBankID;
                this._questionBanks[bankId].addBlock(blockModel);
            }

        },

        _setupRandomisedAssessment: function() {
            var assessmentConfig = this.getConfig();

            var randomisationModel = assessmentConfig._randomisation;
            var blockModels = this.getChildren().models;
            
            var questionModels = _.shuffle(blockModels);

            questionModels = questionModels.slice(0, randomisationModel._blockCount);
            
            return questionModels;
        },

        _overrideQuestionComponentSettings: function() {
            var questionConfig = this.getConfig()._questions;
            var questionComponents = this._currentQuestionComponents;

            var newSettings = {};
            if(questionConfig.hasOwnProperty('_canShowFeedback')) {
                newSettings._canShowFeedback = questionConfig._canShowFeedback;
            }

            if(questionConfig.hasOwnProperty('_canShowModelAnswer')) {
                newSettings._canShowModelAnswer = questionConfig._canShowModelAnswer;
            }

            if (questionConfig.hasOwnProperty('_canShowMarking')) {
                newSettings._canShowMarking = questionConfig._canShowMarking;
            }

            if(!_.isEmpty(newSettings)) {
                for (var i = 0, l = questionComponents.length; i < l; i++) {
                    questionComponents[i].set(newSettings, { pluginName: "_assessment" });
                }
            }

        },

        _setupQuestionListeners: function() {
            var questionComponents = this._currentQuestionComponents;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                if (question.get("_isInteractionComplete")) continue;
                this.listenTo(question, 'change:_isInteractionComplete', this._onQuestionCompleted);
            }
        },

        _checkNumberOfQuestionsAnswered: function() {
            var questionComponents = this._currentQuestionComponents;
            var numberOfQuestionsAnswered = 0;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                if (question.get("_isInteractionComplete")) {
                    numberOfQuestionsAnswered++;
                }
            }
            this.set("_numberOfQuestionsAnswered", numberOfQuestionsAnswered);
        },

        _removeQuestionListeners: function() {
            var questionComponents = this._currentQuestionComponents;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                this.stopListening(question, 'change:_isInteractionComplete', this._onQuestionCompleted);
            }
        },

        _onQuestionCompleted: function(questionModel, value) {
            if (value === false) return;
            if(!questionModel.get('_isInteractionComplete')) return;

            var numberOfQuestionsAnswered = this.get("_numberOfQuestionsAnswered");
            numberOfQuestionsAnswered++;
            this.set("_numberOfQuestionsAnswered", numberOfQuestionsAnswered);

            this._updateQuestionsState();
            Adapt.assessment.saveState();

            this._checkAssessmentComplete();
        },

        _checkAssessmentComplete: function() {
            var numberOfQuestionsAnswered = this.get("_numberOfQuestionsAnswered");

            var allQuestionsAnswered = numberOfQuestionsAnswered >= this._currentQuestionComponents.length;
            if (!allQuestionsAnswered) return;
            
            this._onAssessmentComplete();
        },

        _onAssessmentComplete: function() {
            var assessmentConfig = this.getConfig();

            this.set("_attemptInProgress", false);
            this._spendAttempt();

            var scoreAsPercent = this._getScoreAsPercent();
            var score = this._getScore();
            var maxScore = this._getMaxScore();

            this.set({
                '_scoreAsPercent': scoreAsPercent,
                '_score': score,
                '_maxScore': maxScore,
                '_lastAttemptScoreAsPercent': scoreAsPercent,
                '_assessmentCompleteInSession': true,
                '_isAssessmentComplete': true
            });

            this._updateQuestionsState();

            this._checkIsPass();

            this._removeQuestionListeners();
            
            Adapt.trigger('assessments:complete', this.getState(), this);
        },

        _updateQuestionsState: function() {
            var questions = [];

            var questionComponents = this._currentQuestionComponents;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var questionComponent = questionComponents[i];

                var questionModel = {
                    _id: questionComponent.get("_id"),
                    _isCorrect: questionComponent.get("_isCorrect") === undefined ? null : questionComponent.get("_isCorrect")
                };

                //build array of questions
                questions.push(questionModel);

            }
            
            this.set({
                '_questions': questions
            });
        },

        _checkIsPass: function() {
            var assessmentConfig = this.getConfig();

            var isPercentageBased = assessmentConfig._isPercentageBased;
            var scoreToPass = assessmentConfig._scoreToPass;

            var scoreAsPercent = this.get("_scoreAsPercent");
            var score = this.get("_score");

            var isPass = false;
            if (score && scoreAsPercent) {
                if (isPercentageBased) {
                    isPass = (scoreAsPercent >= scoreToPass) ? true : false;
                } else {
                    isPass = (score >= scoreToPass) ? true : false;
                }
            }

            this.set("_isPass", isPass);
        },

        _isAttemptsLeft: function() {
            var assessmentConfig = this.getConfig();

            var isAttemptsEnabled = assessmentConfig._attempts && assessmentConfig._attempts != "infinite";

            if (!isAttemptsEnabled) return true;

            if (this.get('_attemptsLeft') === 0) return false;
        
            return true;
        },

        _spendAttempt: function() {
            if (!this._isAttemptsLeft()) return false;

            var attemptsSpent = this.get("_attemptsSpent");
            attemptsSpent++;
            this.set("_attemptsSpent", attemptsSpent);

            if (this.get('_attempts') == "infinite") return true;

            var attemptsLeft = this.get('_attemptsLeft');
            attemptsLeft--;
            this.set('_attemptsLeft', attemptsLeft);

            return true;
        },

        _getScore: function() {
            var score = 0;
            var questionComponents = this._currentQuestionComponents;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                if (question.get('_isCorrect') && 
                    question.get('_questionWeight')) {
                    score += question.get('_questionWeight');
                }
            }
            return score;
        },
        
        _getMaxScore: function() {
            var maxScore = 0;
            var questionComponents = this._currentQuestionComponents;
            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                if (question.get('_questionWeight')) {
                    maxScore += question.get('_questionWeight');
                }
            }
            return maxScore;
        },
        
        _getScoreAsPercent: function() {
            if (this._getMaxScore() === 0) return 0;
            return Math.round((this._getScore() / this._getMaxScore()) * 100);
        },

        _getLastAttemptScoreAsPercent: function() {
            return this.get('_lastAttemptScoreAsPercent');
        },

        _checkReloadPage: function() {
            if (!this.canResetInPage()) return false;

            var parentId = this.getParent().get("_id");
            var currentLocation = Adapt.location._currentId;

            //check if on assessment page and should rerender page
            if (currentLocation != parentId) return false;
            if (!this.get("_isReady")) return false;

            return true;
        },

        _reloadPage: function() {
            this._forceResetOnRevisit = true;

            Backbone.history.navigate("#/id/"+Adapt.location._currentId, { replace:true, trigger: true });
        },

        _resetQuestions: function() {
            var assessmentConfig = this.getConfig();
            var questionComponents = this._currentQuestionComponents;

            for (var i = 0, l = questionComponents.length; i < l; i++) {
                var question = questionComponents[i];
                question.reset(assessmentConfig._questions._resetType, true);
            }
        },

        _onRemove: function() {
            this._removeQuestionListeners();
        },



        _setCompletionStatus: function() {
            this.set({
                "_isComplete": true,
                "_isInteractionComplete": true,
            });
        },

        _checkIfQuestionsWereRestored: function() {
            if (this.get("_assessmentCompleteInSession")) return;
            if (!this.get("_isAssessmentComplete")) return;

            //fix for courses that do not remember the user selections
            //force assessment to reset if user revisits an assessment page in a new session which is completed
            var wereQuestionsRestored = true;

            var questions = this.get("_questions");
            for (var i = 0, l = questions.length; i < l; i++) {
                var question = questions[i];
                var questionModel = Adapt.findById(question._id);
                if (!questionModel.get("_isSubmitted")) {
                    wereQuestionsRestored = false;
                    break;
                }
            }
        
            if (!wereQuestionsRestored) {
                this.set("_assessmentCompleteInSession", true);
                return true;
            }

            return false;
        },


    //Public Functions

        isAssessmentEnabled: function() {
            if (this.get("_assessment") && 
                this.get("_assessment")._isEnabled) return true;
            return false;
        },

        canResetInPage: function() {
            var assessmentConfig = this.getConfig();
            if (assessmentConfig._reloadPageOnReset === false) return false;
            return true;
        },

        reset: function(force) {
            var assessmentConfig = this.getConfig();

            //check if forcing reset via page revisit or force parameter
            force = this._forceResetOnRevisit || force == true;
            this._forceResetOnRevisit = false;

            var isPageReload = this._checkReloadPage();

            //stop resetting if not complete or not allowed
            if (this.get("_assessmentCompleteInSession") && 
                    !assessmentConfig._isResetOnRevisit && 
                    !isPageReload && 
                    !force) return false;
            
            //check if new session and questions not restored
            var wereQuestionsRestored = this._checkIfQuestionsWereRestored();
            force = force || wereQuestionsRestored;
            // the assessment is going to be reset so we must reset attempts
            // otherwise assessment may not be set up properly in next session
            if (wereQuestionsRestored && !this._isAttemptsLeft()) {
                this.set({'_attemptsLeft':this.get('_attempts')});
                this.set({'_attemptsSpent':0});
            }

            //stop resetting if no attempts left
            if (!this._isAttemptsLeft() && !force) return false;

            if (!isPageReload) {
                //only perform this section when not attempting to reload the page
                this._setupAssessmentData(force);
            } else {
                this._reloadPage();
            }

            return true;
        },

        getSaveState: function() {
            var state = this.getState();
            var questions = state.questions;
            var indexByIdQuestions = _.indexBy(questions, "_id");

            for (var id in indexByIdQuestions) {
                indexByIdQuestions[id] = indexByIdQuestions[id]._isCorrect
            }

            var saveState = [
                state.isComplete ? 1:0,
                state.attemptsSpent,
                state.maxScore,
                state.score,
                state.attemptInProgress ? 1:0,
                indexByIdQuestions
            ];

            return saveState;
        },

        setRestoreState: function(restoreState) {
            var isComplete = restoreState[0] == 1 ? true : false;
            var attempts = this.get("_attempts");
            var attemptsSpent = restoreState[1];
            var maxScore = restoreState[2];
            var score = restoreState[3];
            var attemptInProgress = restoreState[4] == 1 ? true : false;
            var scoreAsPercent;

            var indexByIdQuestions = restoreState[5];

            var blockIds = {};
            for (var id in indexByIdQuestions) {
                var blockId = Adapt.findById(id).get("_parentId");
                blockIds[blockId] = Adapt.findById(blockId);
            }
            var restoredChildrenModels = _.values(blockIds);
            
            if (indexByIdQuestions) this.getChildren().models = restoredChildrenModels;


            this.set("_isAssessmentComplete", isComplete);
            this.set("_assessmentCompleteInSession", false);
            this.set("_attemptsSpent", attemptsSpent );
            this.set("_attemptInProgress", attemptInProgress )

            if (attempts == "infinite") this.set("_attemptsLeft", "infinite");
            else this.set("_attemptsLeft" , attempts - attemptsSpent);

            this.set("_maxScore", maxScore || this._getMaxScore());
            this.set("_score", score || 0);

            if (score) {
                scoreAsPercent = Math.round( score / maxScore  * 100);
            } else {
                scoreAsPercent = 0;
            }
        
            this.set("_scoreAsPercent", scoreAsPercent);
            this.set("_lastAttemptScoreAsPercent", scoreAsPercent)

            
            var questions = [];
            for (var id in indexByIdQuestions) {
                questions.push({
                    _id: id,
                    _isCorrect: indexByIdQuestions[id]
                });
            }

            

            this.set("_questions", questions);
            this._checkIsPass();

        },

        getState: function() {
            //return the current state of the assessment
            //create snapshot of values so as not to create memory leaks
            var assessmentConfig = this.getConfig();

            var state = {
                id: assessmentConfig._id,
                type: "article-assessment",
                pageId: this.getParent().get("_id"),
                isEnabled: assessmentConfig._isEnabled,
                isComplete: this.get("_isAssessmentComplete"),
                isPercentageBased: assessmentConfig._isPercentageBased,
                scoreToPass: assessmentConfig._scoreToPass,
                score: this.get("_score"),
                scoreAsPercent: this.get("_scoreAsPercent"),
                maxScore: this.get("_maxScore"),
                isPass: this.get("_isPass"),
                includeInTotalScore: assessmentConfig._includeInTotalScore,
                assessmentWeight: assessmentConfig._assessmentWeight,
                attempts: this.get("_attempts"),
                attemptsSpent: this.get("_attemptsSpent"),
                attemptsLeft: this.get("_attemptsLeft"),
                attemptInProgress: this.get("_attemptInProgress"),
                lastAttemptScoreAsPercent: this.get('_lastAttemptScoreAsPercent'),
                questions: this.get("_questions"),
                questionModels: new Backbone.Collection(this._currentQuestionComponents)
            };

            return state;
        },

        getConfig: function() {
            var assessmentConfig = this.get("_assessment");
            
            if (!assessmentConfig) {
                assessmentConfig = $.extend(true, {}, assessmentConfigDefaults);
            } else {
                assessmentConfig = $.extend(true, {}, assessmentConfigDefaults, assessmentConfig);
            }
            
            if (assessmentConfig._id === undefined) {
                assessmentConfig._id = "givenId"+(givenIdCount++);
            }
            
            this.set("_assessment", assessmentConfig);

            return assessmentConfig;
        }
        
    };

    return AssessmentModel;
});

define('extensions/adapt-contrib-assessment/js/assessment',[
    'coreJS/adapt'
], function(Adapt) {

    /*
        Here we setup a registry for all assessments
    */

    var assessmentsConfigDefaults = {
        "_postTotalScoreToLms": true,
        "_isPercentageBased": true,
        "_scoreToPass": 100,
        "_requireAssessmentPassed": false,
        "_isDefaultsLoaded": true
    };

    Adapt.assessment = _.extend({

    //Private functions

        _assessments: _.extend([], {
            _byPageId: {},
            _byAssessmentId: {}
        }),

        initialize: function() {
            this.listenTo(Adapt, "assessments:complete", this._onAssessmentsComplete);
            this.listenTo(Adapt, "router:location", this._checkResetAssessmentsOnRevisit);
            this.listenTo(Adapt, "app:dataReady", this._onDataReady);
        },

        _onAssessmentsComplete: function(state) {
            var assessmentId = state.id;

            state.isComplete = true;

            if (assessmentId === undefined) return;

            if (!this._getStateByAssessmentId(assessmentId)) {
                console.warn("assessments: state was not registered when assessment was created");
            }

            this.saveState();

            this._setPageProgress();

            this._checkAssessmentsComplete();

            //need to add spoor assessment state saving

        },

        _restoreModelState: function(assessmentModel) {

            if (!this._saveStateModel) {
                this._saveStateModel = Adapt.offlineStorage.get("assessment");
            }
            if (this._saveStateModel) {
                var state = assessmentModel.getState();
                if (this._saveStateModel[state.id]) {
                    assessmentModel.setRestoreState(this._saveStateModel[state.id]);
                }
            }

        },

        _checkResetAssessmentsOnRevisit: function(toObject) {
            /* 
                Here we hijack router:location to reorganise the assessment blocks 
                this must happen before trickle listens to block completion
            */
            if (toObject._contentType !== "page") return;

            //initialize assessment on page visit before pageView:preRender (and trickle)
            var pageAssessmentModels = this._getAssessmentByPageId(toObject._currentId);
            if (pageAssessmentModels === undefined) return;

            for (var i = 0, l = pageAssessmentModels.length; i < l; i++) {
                var pageAssessmentModel = pageAssessmentModels[i];
                pageAssessmentModel.reset();
            }

            this._setPageProgress();
        },

        _onDataReady: function() {
            this._assessments = _.extend([], {
                _byPageId: {},
                _byAssessmentId: {}
            });
        },

        _checkAssessmentsComplete: function() {
            var allAssessmentsComplete = true;
            var assessmentToPostBack = 0;
            var states = this._getStatesByAssessmentId();

            var assessmentStates = [];

            for (var id in states) {
                var state = states[id];
                if (!state.includeInTotalScore) continue;
                if (!state.isComplete) {
                    allAssessmentsComplete = false;
                    break;
                }
                assessmentToPostBack++;
                assessmentStates.push(state);
            }

            if (!allAssessmentsComplete || assessmentToPostBack === 0) return false;

            if (assessmentToPostBack === 1) {
                this._setupSingleAssessmentConfiguration(assessmentStates[0]);
            }

            this._postScoreToLms();

            return true;
        },

        _setupSingleAssessmentConfiguration: function(assessmentState) {
            var assessmentsConfig = Adapt.course.get("_assessment");
            $.extend(true, assessmentsConfig, {
                "_postTotalScoreToLms": assessmentState.includeInTotalScore,
                "_isPercentageBased": assessmentState.isPercentageBased,
                "_scoreToPass": assessmentState.scoreToPass
            });
            Adapt.course.set("_assessment", assessmentsConfig);
        },
        
        _postScoreToLms: function() {
            var assessmentsConfig = this.getConfig();
            if (assessmentsConfig._postTotalScoreToLms === false) return;
            
            var completionState = this.getState();
            //post completion to spoor
            _.defer(function() {
                Adapt.trigger("assessment:complete", completionState);
            });
        },

        _getAssessmentByPageId: function(pageId) {
            return this._assessments._byPageId[pageId];
        },

        _getStateByAssessmentId: function(assessmentId) {
            return this._assessments._byAssessmentId[assessmentId].getState();
        },

        _getStatesByAssessmentId: function() {
            var states = {};
            for (var i = 0, l = this._assessments.length; i < l; i++) {
                var assessmentModel = this._assessments[i];
                var state = assessmentModel.getState();
                states[state.id] = state;
            }
            return states;
        },

        _setPageProgress: function() {
            //set _subProgressTotal and _subProgressComplete on pages that have assessment progress indicator requirements
            
            var requireAssessmentPassed = this.getConfig()._requireAssessmentPassed;

            for (var k in this._assessments._byPageId) {

                var assessments = this._assessments._byPageId[k];

                var assessmentsTotal = assessments.length;
                var assessmentsPassed = 0;

                for (var i = 0, l = assessments.length; i < l; i++) {
                    var assessmentState = assessments[i].getState();

                    var isComplete;

                    if (requireAssessmentPassed) {
                        
                        if (!assessmentState.includeInTotalScore) {
                            isComplete = assessmentState.isComplete;
                        } else if (assessmentState.isPass) {
                            isComplete = assessmentState.isComplete;
                        }

                    } else {

                        isComplete = assessmentState.isComplete;
                    }

                    if ( isComplete ) {
                        assessmentsPassed+=1; 
                    }
                }

                try {
                    var pageModel = Adapt.findById(k);
                    pageModel.set("_subProgressTotal", assessmentsTotal);
                    pageModel.set("_subProgressComplete", assessmentsPassed);
                } catch(e) {

                }

            }
        },


    //Public functions

        register: function(assessmentModel) {
            var state = assessmentModel.getState();
            var assessmentId = state.id;
            var pageId = state.pageId;

            if (this._assessments._byPageId[pageId] === undefined) {
                this._assessments._byPageId[pageId] = [];
            }
            this._assessments._byPageId[pageId].push(assessmentModel);

            if (assessmentId) {
                this._assessments._byAssessmentId[assessmentId] = assessmentModel;
            }

            this._assessments.push(assessmentModel);

            this._restoreModelState(assessmentModel);

            Adapt.trigger("assessments:register", state, assessmentModel);

            this._setPageProgress();
        },

        get: function(id) {
            if (id === undefined) {
                return this._assessments.slice(0);
            } else {
                return this._assessments._byAssessmentId[id];
            }
        },

        saveState: function() {

            this._saveStateModel = {};
            for (var i = 0, assessmentModel; assessmentModel = this._assessments[i++];) {
                var state = assessmentModel.getState();
                this._saveStateModel[state.id] = assessmentModel.getSaveState();
            }

            Adapt.offlineStorage.set("assessment", this._saveStateModel);
        },

        getConfig: function () {
            var assessmentsConfig = Adapt.course.get("_assessment");

            if (assessmentsConfig && assessmentsConfig._isDefaultsLoaded) {
                return assessmentsConfig;
            }

            if (assessmentsConfig === undefined) {
                assessmentsConfig = $.extend(true, {}, assessmentsConfigDefaults);
            } else {
                assessmentsConfig = $.extend(true, {}, assessmentsConfigDefaults, assessmentsConfig);
            }

            Adapt.course.set("_assessment", assessmentsConfig);

            return assessmentsConfig;
        },
        
        getState: function() {
            var assessmentsConfig = this.getConfig();

            var score = 0;
            var maxScore = 0;
            var isPass = false;
            var totalAssessments = 0;

            var states = this._getStatesByAssessmentId();

            var assessmentsComplete = 0;

            for (var id in states) {
                var state = states[id];
                if (!state.includeInTotalScore) continue;
                if (state.isComplete) assessmentsComplete++;
                totalAssessments++;
                maxScore += state.maxScore / state.assessmentWeight;
                score += state.score / state.assessmentWeight;
                isPass = isPass === false ? false : state.isPass;
            }

            var isComplete = assessmentsComplete == totalAssessments;
            
            var scoreAsPercent = Math.round((score / maxScore) * 100);

            if ((assessmentsConfig._scoreToPass || 100) && isComplete) {
                if (assessmentsConfig._isPercentageBased || true) {
                    if (scoreAsPercent >= assessmentsConfig._scoreToPass) isPass = true;
                } else {
                    if (score >= assessmentsConfig._scoreToPass) isPass = true;
                }
            }

            return {
                isComplete: isComplete,
                isPercentageBased: assessmentsConfig._isPercentageBased,
                requireAssessmentPassed: assessmentsConfig._requireAssessmentPassed,
                isPass: isPass,
                scoreAsPercent: scoreAsPercent,
                maxScore: maxScore,
                score: score,
                assessmentsComplete: assessmentsComplete,
                assessments: totalAssessments
            };
        },

    }, Backbone.Events);

    Adapt.assessment.initialize();

});

define('extensions/adapt-contrib-assessment/js/adapt-assessmentArticleExtension',[
    'coreJS/adapt',
    'coreViews/articleView',
    'coreModels/articleModel',
    './adapt-assessmentArticleView',
    './adapt-assessmentArticleModel',
    './assessment',
], function(Adapt, ArticleView, ArticleModel, AdaptAssessmentArticleView, AdaptAssessmentArticleModel) {

    /*  
        Here we are extending the articleView and articleModel in Adapt.
        This is to accomodate the assessment functionality on the article.
        The advantage of this method is that the assessment behaviour can utilize all of the predefined article behaviour in both the view and the model.
    */  

    //Extends core/js/views/articleView.js
    var ArticleViewInitialize = ArticleView.prototype.initialize;
    ArticleView.prototype.initialize = function(options) {
        if (this.model.get("_assessment") && this.model.get("_assessment")._isEnabled === true) {
            //extend the articleView with new functionality
            _.extend(this, AdaptAssessmentArticleView);
        }
        //initialize the article in the normal manner
        return ArticleViewInitialize.apply(this, arguments);
    };

    //Extends core/js/models/articleModel.js
    var ArticleModelInitialize = ArticleModel.prototype.initialize;
    ArticleModel.prototype.initialize = function(options) {
        if (this.get("_assessment") && this.get("_assessment")._isEnabled === true) {
            //extend the articleModel with new functionality
            _.extend(this, AdaptAssessmentArticleModel);

            //initialize the article in the normal manner
            var returnValue = ArticleModelInitialize.apply(this, arguments);

            //initialize assessment article
            this._postInitialize();

            return returnValue;
        }

        //initialize the article in the normal manner if no assessment
        return ArticleModelInitialize.apply(this, arguments);
    };

});

define('extensions/adapt-contrib-bookmarking/js/adapt-contrib-bookmarking',[
    'coreJS/adapt'
], function(Adapt) {

    var Bookmarking = _.extend({

        bookmarkLevel: null,
        watchViewIds: null,
        watchViews: [],
        restoredLocationID: null,
        currentLocationID: null,

        initialize: function () {
            this.listenToOnce(Adapt, "router:location", this.onAdaptInitialize);
        },

        onAdaptInitialize: function() {
            if (!this.checkIsEnabled()) return;
            this.setupEventListeners();
            this.checkRestoreLocation();
        },

        checkIsEnabled: function() {
            var courseBookmarkModel = Adapt.course.get('_bookmarking');
            if (!courseBookmarkModel || !courseBookmarkModel._isEnabled) return false;
            if (!Adapt.offlineStorage) return false;
            return true;
        },

        setupEventListeners: function() {
            this._onScroll = _.debounce(_.bind(this.checkLocation, Bookmarking), 1000);
            this.listenTo(Adapt, 'menuView:ready', this.setupMenu);
            this.listenTo(Adapt, 'pageView:preRender', this.setupPage);
        },

        checkRestoreLocation: function() {
            this.restoredLocationID = Adapt.offlineStorage.get("location");

            if (!this.restoredLocationID || this.restoredLocationID === "undefined") return;

            this.listenToOnce(Adapt, "pageView:ready menuView:ready", this.restoreLocation);
        },

        restoreLocation: function() {
            _.defer(_.bind(function() {
                this.stopListening(Adapt, "pageView:ready menuView:ready", this.restoreLocation);

                if (this.restoredLocationID == Adapt.location._currentId) return;

                try {
                    var model = Adapt.findById(this.restoredLocationID);
                } catch (error) {
                    return;
                }
                
                if (!model) return;

                var locationOnscreen = $("." + this.restoredLocationID).onscreen();
                var isLocationOnscreen = locationOnscreen && (locationOnscreen.percentInview > 0);
                var isLocationFullyInview = locationOnscreen && (locationOnscreen.percentInview === 100);
                if (isLocationOnscreen && isLocationFullyInview) return;

                this.showPrompt();
            }, this));
        },

        showPrompt: function() {
            var courseBookmarkModel = Adapt.course.get('_bookmarking');
            if (!courseBookmarkModel._buttons) {
                courseBookmarkModel._buttons = {
                    yes: "Yes",
                    no: "No"
                };
            }
            if (!courseBookmarkModel._buttons.yes) courseBookmarkModel._buttons.yes = "Yes";
            if (!courseBookmarkModel._buttons.no) courseBookmarkModel._buttons.no = "No";


            this.listenToOnce(Adapt, "bookmarking:continue", this.navigateToPrevious);
            this.listenToOnce(Adapt, "bookmarking:cancel", this.navigateCancel);

            var promptObject = {
                title: courseBookmarkModel.title,
                body: courseBookmarkModel.body,
                _prompts:[
                    {
                        promptText: courseBookmarkModel._buttons.yes,
                        _callbackEvent: "bookmarking:continue",
                    },
                    {
                        promptText: courseBookmarkModel._buttons.no,
                        _callbackEvent: "bookmarking:cancel",
                    }
                ],
                _showIcon: true
            }

            if (Adapt.config.get("_accessibility") && Adapt.config.get("_accessibility")._isActive) {
                $(".loading").show();
                $("#a11y-focuser").focus();
                $("body").attr("aria-hidden", true);
                _.delay(function() {
                    $(".loading").hide();
                    $("body").removeAttr("aria-hidden");
                    Adapt.trigger('notify:prompt', promptObject);
                }, 3000);
            } else {
                Adapt.trigger('notify:prompt', promptObject);
            }
        },

        navigateToPrevious: function() {
            _.defer(_.bind(function() {
                var isSinglePage = Adapt.contentObjects.models.length == 1; 
                Backbone.history.navigate('#/id/' + this.restoredLocationID, {trigger: true, replace: isSinglePage});
            }, this));
            
            this.stopListening(Adapt, "bookmarking:cancel");
        },

        navigateCancel: function() {
            this.stopListening(Adapt, "bookmarking:continue");
        },

        resetLocationID: function () {
            this.setLocationID('');
        },

        setupMenu: function(menuView) {
            var menuModel = menuView.model;
            //set location as menu id unless menu is course, then reset location
            if (menuModel.get("_parentId")) return this.setLocationID(menuModel.get("_id"));
            else this.resetLocationID();
        },
        
        setupPage: function (pageView) {
            var hasPageBookmarkObject = pageView.model.has('_bookmarking');
            var bookmarkModel = (hasPageBookmarkObject) ? pageView.model.get('_bookmarking') : Adapt.course.get('_bookmarking');
            this.bookmarkLevel = bookmarkModel._level;

            if (!bookmarkModel._isEnabled) {
                this.resetLocationID();
                return;
            } else {
                //set location as page id
                this.setLocationID(pageView.model.get('_id'));

                this.watchViewIds = pageView.model.findDescendants(this.bookmarkLevel+"s").pluck("_id");
                this.listenTo(Adapt, this.bookmarkLevel + "View:postRender", this.captureViews);
                this.listenToOnce(Adapt, "remove", this.releaseViews);
                $(window).on("scroll", this._onScroll);
            }
        },

        captureViews: function (view) {
            this.watchViews.push(view);
        },

        setLocationID: function (id) {
            if (!Adapt.offlineStorage) return;
            if (this.currentLocationID == id) return;
            Adapt.offlineStorage.set("location", id);
            this.currentLocationID = id;
        },

        releaseViews: function () {
            this.watchViews.length = 0;
            this.watchViewIds.length = 0;
            this.stopListening(Adapt, 'remove', this.releaseViews);
            this.stopListening(Adapt, this.bookmarkLevel + 'View:postRender', this.captureViews);
            $(window).off("scroll", this._onScroll);
        },

        checkLocation: function() {
            var highestOnscreen = 0;
            var highestOnscreenLocation = "";

            var locationObjects = [];
            for (var i = 0, l = this.watchViews.length; i < l; i++) {
                var view = this.watchViews[i];

                var isViewAPageChild = (_.indexOf(this.watchViewIds, view.model.get("_id")) > -1 );

                if ( !isViewAPageChild ) continue;

                var element = $("." + view.model.get("_id"));
                var isVisible = (element.is(":visible"));

                if (!isVisible) continue;

                var measurements = element.onscreen();
                if (measurements.percentInview > highestOnscreen) {
                    highestOnscreen = measurements.percentInview;
                    highestOnscreenLocation = view.model.get("_id");
                }
            }

            //set location as most inview component
            if (highestOnscreenLocation) this.setLocationID(highestOnscreenLocation);
        }

    }, Backbone.Events)

    Bookmarking.initialize();

});

define('extensions/adapt-contrib-languagePicker/js/accessibilityView',[
    'core/js/adapt'
], function(Adapt) {

    var AccessibilityView = Backbone.View.extend({

        el: '#accessibility-toggle',

        events: {
            'click' : 'toggleAccessibility'
        },

        initialize: function() {
            this.setupHelpers();

            this.setupUsageInstructions();

            if(Adapt.offlineStorage.ready) {
                this.onOfflineStorageReady();
            } else {
                Adapt.once('offlineStorage:ready', _.bind(this.onOfflineStorageReady, this));
            }
        },

        onOfflineStorageReady: function() {
            Adapt.config.get("_accessibility")._isActive = Adapt.offlineStorage.get('a11y') || false;

            this.configureAccessibility();

            this.render();
        },

        render: function() {
            var hasAccessibility = Adapt.config.has('_accessibility')
                && Adapt.config.get('_accessibility')._isEnabled;

            if (!hasAccessibility) {
                return;
            } else {
                var isActive = Adapt.config.get('_accessibility')._isActive;
                var offLabel = this.model.get("_accessibility") && this.model.get("_accessibility").accessibilityToggleTextOff;
                var onLabel = this.model.get("_accessibility") && this.model.get("_accessibility").accessibilityToggleTextOn;

                var toggleText = isActive ? offLabel : onLabel;

                this.$el.html(toggleText).attr('aria-label', $.a11y_normalize(toggleText));

                if (isActive) {
                    $("html").addClass('accessibility');
                    $("#accessibility-instructions").a11y_focus();
                } else {
                    $("html").removeClass('accessibility');
                }
            }
        },

        toggleAccessibility: function(event) {
            if(event) event.preventDefault();

            var hasAccessibility = Adapt.config.get('_accessibility')._isActive;

            var toggleAccessibility = (hasAccessibility) ? false : true;

            Adapt.config.get('_accessibility')._isActive = toggleAccessibility;

            this.configureAccessibility();

            this.setupUsageInstructions();

            this.render();

            this.trigger('accessibility:toggle');
        },

        setupHelpers: function() {
            var config = Adapt.config.get("_accessibility");

            Handlebars.registerHelper('a11y_text', function(text) {
                //ALLOW ENABLE/DISABLE OF a11y_text HELPER
                if (config && config._isTextProcessorEnabled === false) {
                    return text;
                } else {
                    return $.a11y_text(text);
                }
            });
        },

        configureAccessibility: function() {

            var isActive = Adapt.config.get('_accessibility')._isActive;

            if (!Modernizr.touch && (Adapt.offlineStorage.get('a11y') !== isActive)) {
                Adapt.offlineStorage.set("a11y", isActive);
            }

            if (isActive) {

                _.extend($.a11y.options, {
                    isTabbableTextEnabled: true,
                    isUserInputControlEnabled: true,
                    isFocusControlEnabled: true,
                    isFocusLimited: true,
                    isRemoveNotAccessiblesEnabled: true,
                    isAriaLabelFixEnabled: true,
                    isFocusWrapEnabled: true,
                    isScrollDisableEnabled: true,
                    isScrollDisabledOnPopupEnabled: false,
                    isSelectedAlertsEnabled: true,
                    isAlertsEnabled: true
                });
            } else {
                _.extend($.a11y.options, {
                    isTabbableTextEnabled: false,
                    isUserInputControlEnabled: true,
                    isFocusControlEnabled: true,
                    isFocusLimited: false,
                    isRemoveNotAccessiblesEnabled: true,
                    isAriaLabelFixEnabled: true,
                    isFocusWrapEnabled: true,
                    isScrollDisableEnabled: true,
                    isScrollDisabledOnPopupEnabled: false,
                    isSelectedAlertsEnabled: false,
                    isAlertsEnabled: false
                });
            }

            $.a11y.ready();
        },

        setupUsageInstructions: function() {
            if (!this.model.get("_accessibility") || !this.model.get("_accessibility")._accessibilityInstructions) {
                $("#accessibility-instructions").remove();
                return;
            }

            var instructionsList =  this.model.get("_accessibility")._accessibilityInstructions;

            var usageInstructions;
            if (instructionsList[Adapt.device.browser]) {
                usageInstructions = instructionsList[Adapt.device.browser];
            } else if (Modernizr.touch) {
                usageInstructions = instructionsList.touch || "";
            } else {
                usageInstructions = instructionsList.notouch || "";
            }

           $("#accessibility-instructions").html( usageInstructions );
        }

    });

    return AccessibilityView;

});
define('extensions/adapt-contrib-languagePicker/js/languagePickerView',[
    'core/js/adapt',
    './accessibilityView'
], function(Adapt, accessibilityView) {
    
    var LanguagePickerView = Backbone.View.extend({
        
        events: {
            'click .languagepicker-languages button': 'onLanguageClick'
        },
        
        className: 'languagepicker',
        
        initialize: function () {
            this.initializeAccessibility();
            $("html").addClass("in-languagepicker");
            this.listenTo(Adapt, 'remove', this.remove);
            this.render();
        },
        
        render: function () {
            var data = this.model.toJSON();
            var template = Handlebars.templates[this.constructor.template];
            this.$el.html(template(data));
            
            document.title = this.model.get('title') || "";
            
            _.defer(_.bind(function () {
                this.postRender();
            }, this));
        },
        
        postRender: function () {
            $('.loading').hide();
        },
        
        onLanguageClick: function (event) {
            this.destroyAccessibility();
            this.model.setLanguage($(event.target).val());
        },

        initializeAccessibility: function() {
            this.accessibilityView = new accessibilityView({
                model:this.model
            });
            
            // we need to re-render if accessibility gets switched on
            this.listenTo(this.accessibilityView, 'accessibility:toggle', this.render);
        },

        destroyAccessibility: function() {
            this.accessibilityView.remove();
        },

        remove: function() {
            $("html").removeClass("in-languagepicker");

            Backbone.View.prototype.remove.apply(this, arguments);
        }
        
    }, {
        template: 'languagePickerView'
    });

    return LanguagePickerView;

});

define('extensions/adapt-contrib-languagePicker/js/languagePickerDrawerView',[
    'core/js/adapt',
    'backbone'
], function(Adapt, Backbone) {
    
    var LanguagePickerDrawerView = Backbone.View.extend({
        
        events: {
            'click button': 'onButtonClick'
        },
        
        initialize: function () {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(Adapt, 'languagepicker:changelanguage:yes', this.onDoChangeLanguage);
            this.listenTo(Adapt, 'languagepicker:changelanguage:no', this.onDontChangeLanguage);
            this.render();
        },
        
        render: function () {
            var data = this.model.toJSON();
            var template = Handlebars.templates[this.constructor.template];
            this.$el.html(template(data));
        },
        
        onButtonClick: function (event) {
            var newLanguage = $(event.target).attr('data-language');
            this.model.set('newLanguage', newLanguage);
            var data = this.model.getLanguageDetails(newLanguage);
            
            var promptObject = {
                _classes: "dir-ltr",
                title: data.warningTitle,
                body: data.warningMessage,
                _prompts:[
                    {
                        promptText: data._buttons.yes,
                        _callbackEvent: "languagepicker:changelanguage:yes"
                    },
                    {
                        promptText: data._buttons.no,
                        _callbackEvent: "languagepicker:changelanguage:no"
                    }
                ],
                _showIcon: true
            };

            if (data._direction === 'rtl') {
                promptObject._classes = "dir-rtl";
            }
            
            //keep active element incase the user cancels - usually navigation bar icon
            this.$finishFocus = $.a11y.state.focusStack.pop();
            //move drawer close focus to #focuser
            $.a11y.state.focusStack.push($("#focuser"));

            Adapt.once('drawer:closed', function() {
                //wait for drawer to fully close
                _.delay(function(){
                    //show yes/no popup
                    Adapt.once('popup:opened', function() {
                        //move popup close focus to #focuser
                        $.a11y.state.focusStack.pop();
                        $.a11y.state.focusStack.push($("#focuser"));
                    });

                    Adapt.trigger('notify:prompt', promptObject);
                }, 250);
            });

            Adapt.trigger('drawer:closeDrawer');
        },
        
        onDoChangeLanguage: function () {
            // set default languge
            var newLanguage = this.model.get('newLanguage');
            this.model.setLanguage(newLanguage);
            this.remove();
        },
        
        onDontChangeLanguage: function () {
            this.remove();

            //wait for notify to close fully
            _.delay(_.bind(function(){
                //focus on navigation bar icon
                this.$finishFocus.a11y_focus();
            }, this), 500);

        }
        
    }, {
        template: 'languagePickerDrawerView'
    });

    return LanguagePickerDrawerView;

});

define('extensions/adapt-contrib-languagePicker/js/languagePickerNavView',[
    'core/js/adapt',
    'backbone',
    './languagePickerDrawerView'
], function(Adapt, Backbone, LanguagePickerDrawerView) {
    
    var LanguagePickerNavView = Backbone.View.extend({
        
        tagName: 'button',
        
        className: function () {
            var classNames = 'languagepicker-icon base icon';
            var customClass = this.model.get('_languagePickerIconClass') || 'icon-language-2';

            return classNames + ' ' + customClass;
        },
        
        events: {
            'click': 'onClick'
        },
        
        initialize: function () {
            this.listenTo(Adapt, 'remove', this.remove);
        },
        
        onClick: function (event) {
            Adapt.drawer.triggerCustomView(new LanguagePickerDrawerView({model: this.model}).$el, false);
        }
        
    });

    return LanguagePickerNavView;

});

define('extensions/adapt-contrib-languagePicker/js/languagePickerModel',[
        'core/js/adapt',
        'backbone'
], function (Adapt, Backbone) {
    
    var LanguagePickerModel = Backbone.Model.extend({
        
        defaults: {
            "_isEnabled": false,
            "displayTitle": "",
            "body": "",
            "_languages": []
        },
        
        initialize: function () {
            this.listenTo(Adapt.config, 'change:_activeLanguage', this.onConfigChange);
        },

        getLanguageDetails: function (language) {
            var _languages = this.get('_languages');
            return _.find(_languages, function (item) {
                return (item._language == language);
            });
        },

        setLanguage: function (language) {
            Adapt.config.set({
                '_activeLanguage': language,
                '_defaultDirection': this.getLanguageDetails(language)._direction
            });
        },
        
        onConfigChange: function (model, value, options) {
            this.markLanguageAsSelected(value);
        },
        
        markLanguageAsSelected: function(language) {
            var languages = this.get('_languages');

            for (var i = 0; i < languages.length; i++) {
                if (languages[i]._language === language) {
                    languages[i]._isSelected = true;
                } else {
                    languages[i]._isSelected = false;
                }
            }

            this.set('_languages', languages);
        }
        
    });
    
    return LanguagePickerModel;
    
});

define('extensions/adapt-contrib-languagePicker/js/adapt-languagePicker',[
    'core/js/adapt',
    'backbone',
    './languagePickerView',
    './languagePickerNavView',
    './languagePickerModel'
], function(Adapt, Backbone, LanguagePickerView, LanguagePickerNavView, LanguagePickerModel) {

    var languagePickerModel;

    Adapt.once('configModel:dataLoaded', onConfigLoaded);

    /**
     * Once the Adapt config has loaded, check to see if the language picker is enabled. If it is:
     * - stop the rest of the .json from loading
     * - set up the language picker model
     * - register for events to allow us to display the language picker icon in the navbar on pages and menus
     * - wait for offline storage to be ready so that we can check to see if there's a stored language choice or not
     */
    function onConfigLoaded() {
        if (!Adapt.config.has('_languagePicker')) return;
        if (!Adapt.config.get('_languagePicker')._isEnabled) return;
    
        Adapt.config.set("_canLoadData", false);

        languagePickerModel = new LanguagePickerModel(Adapt.config.get('_languagePicker'));
        
        Adapt.on('router:page', setupNavigationView);
        Adapt.on('router:menu', setupNavigationView);
            
        if(Adapt.offlineStorage.ready) {// on the offchance that it may already be ready...
            onOfflineStorageReady();
        } else {
            Adapt.once('offlineStorage:ready', onOfflineStorageReady);
        }
    }

    /**
     * Once offline storage is ready, check to see if a language was previously selected by the user
     * If it was, load it. If it wasn't, show the language picker
     */
    function onOfflineStorageReady() {
        var storedLanguage = Adapt.offlineStorage.get("lang");

        if (storedLanguage) {
            languagePickerModel.setLanguage(storedLanguage);
        } else if (languagePickerModel.get('_showOnCourseLoad') === false) {
            languagePickerModel.setLanguage(Adapt.config.get('_defaultLanguage'));
        } else {
            showLanguagePickerView();
        }
    }

    function showLanguagePickerView () {
        var languagePickerView = new LanguagePickerView({
            model: languagePickerModel
        });
        
        languagePickerView.$el.appendTo('#wrapper');
    }
    
    function setupNavigationView () {
        var languagePickerNavView = new LanguagePickerNavView({
            model: languagePickerModel
        });
        
        languagePickerNavView.$el.appendTo('.navigation-inner');
    }
    
});

define('extensions/adapt-contrib-pageLevelProgress/js/completionCalculations',[
    'coreJS/adapt'
], function(Adapt) {
    
    // Calculate completion of a contentObject
    function calculateCompletion(contentObjectModel) {

        var viewType = contentObjectModel.get('_type'),
            nonAssessmentComponentsTotal = 0,
            nonAssessmentComponentsCompleted = 0,
            assessmentComponentsTotal = 0,
            assessmentComponentsCompleted = 0,
            subProgressCompleted = 0,
            subProgressTotal = 0,
            isComplete = contentObjectModel.get("_isComplete") ? 1 : 0;

        // If it's a page
        if (viewType == 'page') {
            var children = contentObjectModel.findDescendants('components').where({'_isAvailable': true, '_isOptional': false});

            var availableChildren = filterAvailableChildren(children);
            var components = getPageLevelProgressEnabledModels(availableChildren);

            var nonAssessmentComponents = getNonAssessmentComponents(components);

            nonAssessmentComponentsTotal = nonAssessmentComponents.length | 0,
            nonAssessmentComponentsCompleted = getComponentsCompleted(nonAssessmentComponents).length;

            var assessmentComponents = getAssessmentComponents(components);

            assessmentComponentsTotal = assessmentComponents.length | 0,
            assessmentComponentsCompleted = getComponentsInteractionCompleted(assessmentComponents).length;

            subProgressCompleted = contentObjectModel.get("_subProgressComplete") || 0;
            subProgressTotal = contentObjectModel.get("_subProgressTotal") || 0;

            var pageCompletion = {
                "subProgressCompleted": subProgressCompleted,
                "subProgressTotal": subProgressTotal,
                "nonAssessmentCompleted": nonAssessmentComponentsCompleted,
                "nonAssessmentTotal": nonAssessmentComponentsTotal,
                "assessmentCompleted": assessmentComponentsCompleted,
                "assessmentTotal": assessmentComponentsTotal
            };

            if (contentObjectModel.get("_pageLevelProgress") && contentObjectModel.get("_pageLevelProgress")._showPageCompletion !== false 
                && Adapt.course.get("_pageLevelProgress") && Adapt.course.get("_pageLevelProgress")._showPageCompletion !== false) {
                //optionally add one point extra for page completion to eliminate incomplete pages and full progress bars
                // if _showPageCompletion is true then the progress bar should also consider it so add 1 to nonAssessmentTotal
                pageCompletion.nonAssessmentCompleted += isComplete;
                pageCompletion.nonAssessmentTotal += 1;
            }

            return pageCompletion;
        }
        // If it's a sub-menu
        else if (viewType == 'menu') {

            _.each(contentObjectModel.get('_children').models, function(contentObject) {
                var completionObject = calculateCompletion(contentObject);
                subProgressCompleted += contentObjectModel.subProgressCompleted || 0;
                subProgressTotal += contentObjectModel.subProgressTotal || 0;
                nonAssessmentComponentsTotal += completionObject.nonAssessmentTotal;
                nonAssessmentComponentsCompleted += completionObject.nonAssessmentCompleted;
                assessmentComponentsTotal += completionObject.assessmentTotal;
                assessmentComponentsCompleted += completionObject.assessmentCompleted;
            });

            return {
                "subProgressCompleted": subProgressCompleted,
                "subProgressTotal" : subProgressTotal,
                "nonAssessmentCompleted": nonAssessmentComponentsCompleted,
                "nonAssessmentTotal": nonAssessmentComponentsTotal,
                "assessmentCompleted": assessmentComponentsCompleted,
                "assessmentTotal": assessmentComponentsTotal,
            };
        }
    }

    function getNonAssessmentComponents(models) {
        return _.filter(models, function(model) {
            return !model.get('_isPartOfAssessment');
        });
    }

    function getAssessmentComponents(models) {
        return _.filter(models, function(model) {
            return model.get('_isPartOfAssessment');
        });
    }

    function getComponentsCompleted(models) {
        return _.filter(models, function(item) {
            return item.get('_isComplete');
        });
    }

    function getComponentsInteractionCompleted(models) {
        return _.filter(models, function(item) {
            return item.get('_isInteractionComplete');
        });
    }

    //Get only those models who were enabled for pageLevelProgress
    function getPageLevelProgressEnabledModels(models) {
        return _.filter(models, function(model) {
            if (model.get('_pageLevelProgress')) {
                return model.get('_pageLevelProgress')._isEnabled;
            }
        });
    }

    function unavailableInHierarchy(parents) {
        if (parents.length > 0) {
            var parentsAvailable = _.map(parents, function(parent) {
                return parent.get('_isAvailable');
            });
            return _.indexOf(parentsAvailable, false) > -1;
        } else {
            return;
        }
    }

    function filterAvailableChildren(children) {
        var availableChildren = [];

        for(var child=0; child < children.length; child++) {
            var parents = children[child].getParents().models;
            if (!unavailableInHierarchy(parents)) {
                availableChildren.push(children[child]);
            }
        }

        return availableChildren;
    }

    return {
    	calculateCompletion: calculateCompletion,
    	getPageLevelProgressEnabledModels: getPageLevelProgressEnabledModels,
        filterAvailableChildren: filterAvailableChildren
    };

})
;
define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var PageLevelProgressMenuView = Backbone.View.extend({

        className: 'page-level-progress-menu-item',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);

            this.ariaText = '';
            if (Adapt.course.get('_globals')._extensions && Adapt.course.get('_globals')._extensions._pageLevelProgress && Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressMenuBar) {
                this.ariaText = Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressMenuBar + ' ';
            }

            this.render();

            _.defer(_.bind(function() {
                this.updateProgressBar();
            }, this));
        },

        events: {
        },

        render: function() {
            var data = this.model.toJSON();
            _.extend(data, {
                _globals: Adapt.course.get('_globals')
            });
            var template = Handlebars.templates['pageLevelProgressMenu'];

            this.$el.html(template(data));
            return this;
        },

        updateProgressBar: function() {
            if (this.model.get('completedChildrenAsPercentage')) {
                var percentageOfCompleteComponents = this.model.get('completedChildrenAsPercentage');
            } else {
                var percentageOfCompleteComponents = 0;
            }

            // Add percentage of completed components as an aria label attribute
            this.$('.page-level-progress-menu-item-indicator-bar .aria-label').html(this.ariaText + Math.floor(percentageOfCompleteComponents) + '%');

        },

    });

    return PageLevelProgressMenuView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var PageLevelProgressView = Backbone.View.extend({

        className: 'page-level-progress',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.render();
        },

        events: {
            'click .page-level-progress-item button': 'scrollToPageElement'
        },

        scrollToPageElement: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            var currentComponentSelector = '.' + $(event.currentTarget).attr('data-page-level-progress-id');
            var $currentComponent = $(currentComponentSelector);
            Adapt.once('drawer:closed', function() {
                Adapt.scrollTo($currentComponent, { duration:400 });
            });
            Adapt.trigger('drawer:closeDrawer');
        },

        render: function() {
            var components = this.collection.toJSON();
            var data = {
                components: components,
                _globals: Adapt.course.get('_globals')
            };
            var template = Handlebars.templates['pageLevelProgress'];
            this.$el.html(template(data));
            this.$el.a11y_aria_label(true);
            return this;
        }

    });

    return PageLevelProgressView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView',['require','coreJS/adapt','backbone','./completionCalculations','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');
    var completionCalculations = require('./completionCalculations');

    var PageLevelProgressView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView');

    var PageLevelProgressNavigationView = Backbone.View.extend({

        tagName: 'button',

        className: 'base page-level-progress-navigation',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(Adapt, 'router:location', this.updateProgressBar);
            this.listenTo(Adapt, 'pageLevelProgress:update', this.refreshProgressBar);
            this.listenTo(this.collection, 'change:_isInteractionComplete', this.updateProgressBar);
            this.listenTo(this.model, 'change:_isInteractionComplete', this.updateProgressBar);
            this.$el.attr('role', 'button');
            this.ariaText = '';
            
            if (Adapt.course.has('_globals') && Adapt.course.get('_globals')._extensions && Adapt.course.get('_globals')._extensions._pageLevelProgress && Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressIndicatorBar) {
                this.ariaText = Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressIndicatorBar +  ' ';
            }
            
            this.render();
            
            _.defer(_.bind(function() {
                this.updateProgressBar();
            }, this));
        },

        events: {
            'click': 'onProgressClicked'
        },

        render: function() {
            var components = this.collection.toJSON();
            var data = {
                components: components,
                _globals: Adapt.course.get('_globals')
            };            

            var template = Handlebars.templates['pageLevelProgressNavigation'];
            $('.navigation-drawer-toggle-button').after(this.$el.html(template(data)));
            return this;
        },
        
        refreshProgressBar: function() {
            var currentPageComponents = this.model.findDescendants('components').where({'_isAvailable': true});
            var availableChildren = completionCalculations.filterAvailableChildren(currentPageComponents);
            var enabledProgressComponents = completionCalculations.getPageLevelProgressEnabledModels(availableChildren);
            
            this.collection = new Backbone.Collection(enabledProgressComponents);
            this.updateProgressBar();
        },

        updateProgressBar: function() {
            var completionObject = completionCalculations.calculateCompletion(this.model);
            
            //take all assessment, nonassessment and subprogress into percentage
            //this allows the user to see if assessments have been passed, if assessment components can be retaken, and all other component's completion
            
            var completed = completionObject.nonAssessmentCompleted + completionObject.assessmentCompleted + completionObject.subProgressCompleted;
            var total  = completionObject.nonAssessmentTotal + completionObject.assessmentTotal + completionObject.subProgressTotal;

            var percentageComplete = Math.floor((completed / total)*100);


            this.$('.page-level-progress-navigation-bar').css('width', percentageComplete + '%');

            // Add percentage of completed components as an aria label attribute
            this.$el.attr('aria-label', this.ariaText +  percentageComplete + '%');

            // Set percentage of completed components to model attribute to update progress on MenuView
            this.model.set('completedChildrenAsPercentage', percentageComplete);
        },

        onProgressClicked: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            Adapt.drawer.triggerCustomView(new PageLevelProgressView({collection: this.collection}).$el, false);
        }

    });

    return PageLevelProgressNavigationView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/adapt-contrib-pageLevelProgress',['require','coreJS/adapt','backbone','./completionCalculations','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');
    var completionCalculations = require('./completionCalculations');

    var PageLevelProgressMenuView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView');
    var PageLevelProgressNavigationView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView');

    function setupPageLevelProgress(pageModel, enabledProgressComponents) {

        new PageLevelProgressNavigationView({model: pageModel, collection:  new Backbone.Collection(enabledProgressComponents) });

    }

    // This should add/update progress on menuView
    Adapt.on('menuView:postRender', function(view) {

        if (view.model.get('_id') == Adapt.location._currentId) return;

        // do not proceed until pageLevelProgress enabled on course.json
        if (!Adapt.course.get('_pageLevelProgress') || !Adapt.course.get('_pageLevelProgress')._isEnabled) {
            return;
        }

        var pageLevelProgress = view.model.get('_pageLevelProgress');
        var viewType = view.model.get('_type');

        // Progress bar should not render for course viewType
        if (viewType == 'course') return;

        if (pageLevelProgress && pageLevelProgress._isEnabled) {

            var completionObject = completionCalculations.calculateCompletion(view.model);

            //take all non-assessment components and subprogress info into the percentage
            //this allows the user to see if the assessments are passed (subprogress) and all other components are complete
            
            var completed = completionObject.nonAssessmentCompleted + completionObject.subProgressCompleted;
            var total = completionObject.nonAssessmentTotal + completionObject.subProgressTotal;

            var percentageComplete = Math.floor((completed / total)*100);
            
            view.model.set('completedChildrenAsPercentage', percentageComplete);
            view.$el.find('.menu-item-inner').append(new PageLevelProgressMenuView({model: view.model}).$el);

        }

    });

    // This should add/update progress on page navigation bar
    Adapt.on('router:page', function(pageModel) {

        // do not proceed until pageLevelProgress enabled on course.json
        if (!Adapt.course.get('_pageLevelProgress') || !Adapt.course.get('_pageLevelProgress')._isEnabled) {
            return;
        }

        var currentPageComponents = pageModel.findDescendants('components').where({'_isAvailable': true});
        var availableComponents = completionCalculations.filterAvailableChildren(currentPageComponents);
        var enabledProgressComponents = completionCalculations.getPageLevelProgressEnabledModels(availableComponents);

        if (enabledProgressComponents.length > 0) {
            setupPageLevelProgress(pageModel, enabledProgressComponents);
        }

    });

});

define('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesView',['require','backbone','core/js/adapt'],function(require) {

    var Backbone = require('backbone');
    var Adapt = require('core/js/adapt');

    var ResourcesView = Backbone.View.extend({

        className: "resources",

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.render();
        },

        events: {
            'click .resources-filter button': 'onFilterClicked',
            'click .resources-item-container button': 'onResourceClicked'
        },

        render: function() {
            var collectionData = this.collection.toJSON();
            var modelData = this.model.toJSON();
            var template = Handlebars.templates["resources"];
            this.$el.html(template({model: modelData, resources:collectionData, _globals: Adapt.course.get('_globals')}));
            _.defer(_.bind(this.postRender, this));
            return this;
        },

        postRender: function() {
            this.listenTo(Adapt, 'drawer:triggerCustomView', this.remove);
        },

        onFilterClicked: function(event) {
            event.preventDefault();
            var $currentTarget = $(event.currentTarget);
            this.$('.resources-filter button').removeClass('selected');
            var filter = $currentTarget.addClass('selected').attr('data-filter');
            var items = [];

            if (filter === 'all') {
                items = this.$('.resources-item').removeClass('display-none');
            } else {
                this.$('.resources-item').removeClass('display-none').not("." + filter).addClass('display-none');
                items = this.$('.resources-item.' + filter);
            }

            if (items.length === 0) return;
            $(items[0]).a11y_focus();
        },

        onResourceClicked: function(event) {
            var data = $(event.currentTarget).data();

            if (data.type !== 'document') {
                window.top.open(data.href);
                return;
            }
            var dummyLink = document.createElement('a');
            dummyLink.download = data.filename;
            dummyLink.href = data.href;

            document.body.appendChild(dummyLink);
            dummyLink.click();
            document.body.removeChild(dummyLink);
            delete dummyLink;
        }
    });

    return ResourcesView;
});

define('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesHelpers',['require','handlebars'],function(require) {

	var Handlebars = require('handlebars');

	Handlebars.registerHelper('if_collection_contains', function(collection, attribute, value, block) {
		var makeBlockVisible = false;

		_.each(collection, function(resource) {
			if (resource[attribute] === value) {
				makeBlockVisible = true;
			}
		});
		if(makeBlockVisible) {
            return block.fn(this);
        } else {
            return block.inverse();
        }
    });

    Handlebars.registerHelper('if_collection_contains_only_one_item', function(collection, attribute, block) {
		var attributeCount = [];

		_.each(collection, function(resource) {
			var resourceAttribute = resource[attribute];
			if (_.indexOf(attributeCount, resourceAttribute) === -1) {
				attributeCount.push(resourceAttribute);
			}
		});

		if (attributeCount.length <= 1) {
			return block.fn(this);
		} else {
			return block.inverse(this);
		}

    });

    Handlebars.registerHelper('return_column_layout_from_collection_length', function(collection, attribute) {
		var attributeCount = [];

		_.each(collection, function(resource) {
			var resourceAttribute = resource[attribute];
			if (_.indexOf(attributeCount, resourceAttribute) === -1) {
				attributeCount.push(resourceAttribute);
			}
		});

		return (attributeCount.length + 1);

    });

})
	;
define('extensions/adapt-contrib-resources/js/adapt-contrib-resources',[
    'backbone',
    'core/js/adapt',
    './adapt-contrib-resourcesView',
    './adapt-contrib-resourcesHelpers'
], function(Backbone, Adapt, ResourcesView, ResourcesHelpers) {

    function setupResources(resourcesData) {

        var resourcesModel = new Backbone.Model(resourcesData);
        var resourcesCollection = new Backbone.Collection(resourcesModel.get('_resourcesItems'));

        Adapt.on('resources:showResources', function() {
            Adapt.drawer.triggerCustomView(new ResourcesView({
                model: resourcesModel,
                collection: resourcesCollection
            }).$el);
        });

    }

    function initResources() {

        var courseResources = Adapt.course.get('_resources');

        // do not proceed until resource set on course.json
        if (!courseResources || courseResources._isEnabled === false) return;

        var drawerObject = {
            title: courseResources.title,
            description: courseResources.description,
            className: 'resources-drawer'
        };

        Adapt.drawer.addItem(drawerObject, 'resources:showResources');

        setupResources(courseResources);

    }

    Adapt.once('app:dataReady', function() {
        initResources();
        Adapt.on('app:languageChanged', initResources);
    });

});

/*global console*/

/* ===========================================================

pipwerks SCORM Wrapper for JavaScript
v1.1.20160322

Created by Philip Hutchison, January 2008-2016
https://github.com/pipwerks/scorm-api-wrapper

Copyright (c) Philip Hutchison
MIT-style license: http://pipwerks.mit-license.org/

This wrapper works with both SCORM 1.2 and SCORM 2004.

Inspired by APIWrapper.js, created by the ADL and
Concurrent Technologies Corporation, distributed by
the ADL (http://www.adlnet.gov/scorm).

SCORM.API.find() and SCORM.API.get() functions based
on ADL code, modified by Mike Rustici
(http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison

=============================================================== */


var pipwerks = {};                                  //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
pipwerks.UTILS = {};                                //For holding UTILS functions
pipwerks.debug = { isActive: true };                //Enable (true) or disable (false) for debug mode

pipwerks.SCORM = {                                  //Define the SCORM object
    version:    null,                               //Store SCORM version.
    handleCompletionStatus: true,                   //Whether or not the wrapper should automatically handle the initial completion status
    handleExitMode: true,                           //Whether or not the wrapper should automatically handle the exit mode
    API:        { handle: null,
                  isFound: false },                 //Create API child object
    connection: { isActive: false },                //Create connection child object
    data:       { completionStatus: null,
                  exitStatus: null },               //Create data child object
    debug:      {}                                  //Create debug child object
};



/* --------------------------------------------------------------------------------
   pipwerks.SCORM.isAvailable
   A simple function to allow Flash ExternalInterface to confirm
   presence of JS wrapper before attempting any LMS communication.

   Parameters: none
   Returns:    Boolean (true)
----------------------------------------------------------------------------------- */

pipwerks.SCORM.isAvailable = function(){
    return true;
};



// ------------------------------------------------------------------------- //
// --- SCORM.API functions ------------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.find(window)
   Looks for an object named API in parent and opener windows

   Parameters: window (the browser window object).
   Returns:    Object if API is found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.find = function(win){

    var API = null,
        findAttempts = 0,
        findAttemptLimit = 500,
        traceMsgPrefix = "SCORM.API.find",
        trace = pipwerks.UTILS.trace,
        scorm = pipwerks.SCORM;

    while ((!win.API && !win.API_1484_11) &&
           (win.parent) &&
           (win.parent != win) &&
           (findAttempts <= findAttemptLimit)){

                findAttempts++;
                win = win.parent;

    }

    //If SCORM version is specified by user, look for specific API
    if(scorm.version){

        switch(scorm.version){

            case "2004" :

                if(win.API_1484_11){

                    API = win.API_1484_11;

                } else {

                    trace(traceMsgPrefix +": SCORM version 2004 was specified by user, but API_1484_11 cannot be found.");

                }

                break;

            case "1.2" :

                if(win.API){

                    API = win.API;

                } else {

                    trace(traceMsgPrefix +": SCORM version 1.2 was specified by user, but API cannot be found.");

                }

                break;

        }

    } else {                             //If SCORM version not specified by user, look for APIs

        if(win.API_1484_11) {            //SCORM 2004-specific API.

            scorm.version = "2004";      //Set version
            API = win.API_1484_11;

        } else if(win.API){              //SCORM 1.2-specific API

            scorm.version = "1.2";       //Set version
            API = win.API;

        }

    }

    if(API){

        trace(traceMsgPrefix +": API found. Version: " +scorm.version);
        trace("API: " +API);

    } else {

        trace(traceMsgPrefix +": Error finding API. \nFind attempts: " +findAttempts +". \nFind attempt limit: " +findAttemptLimit);

    }

    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.get()
   Looks for an object named API, first in the current window's frame
   hierarchy and then, if necessary, in the current window's opener window
   hierarchy (if there is an opener window).

   Parameters:  None.
   Returns:     Object if API found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.get = function(){

    var API = null,
        win = window,
        scorm = pipwerks.SCORM,
        find = scorm.API.find,
        trace = pipwerks.UTILS.trace;

    API = find(win);

    if(!API && win.parent && win.parent != win){
        API = find(win.parent);
    }

    if(!API && win.top && win.top.opener){
        API = find(win.top.opener);
    }

    //Special handling for Plateau
    //Thanks to Joseph Venditti for the patch
    if(!API && win.top && win.top.opener && win.top.opener.document) {
        API = find(win.top.opener.document);
    }

    if(API){
        scorm.API.isFound = true;
    } else {
        trace("API.get failed: Can't find the API!");
    }

    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.getHandle()
   Returns the handle to API object if it was previously set

   Parameters:  None.
   Returns:     Object (the pipwerks.SCORM.API.handle variable).
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.getHandle = function() {

    var API = pipwerks.SCORM.API;

    if(!API.handle && !API.isFound){

        API.handle = API.get();

    }

    return API.handle;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.connection functions --------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.initialize()
   Tells the LMS to initiate the communication session.

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.initialize = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.initialize ";

    trace("connection.initialize called.");

    if(!scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSInitialize("")); break;
                case "2004": success = makeBoolean(API.Initialize("")); break;
            }

            if(success){

                //Double-check that connection is active and working before returning 'true' boolean
                errorCode = debug.getCode();

                if(errorCode !== null && errorCode === 0){

                    scorm.connection.isActive = true;

                    if(scorm.handleCompletionStatus){

                        //Automatically set new launches to incomplete
                        completionStatus = scorm.status("get");

                        if(completionStatus){

                            switch(completionStatus){

                                //Both SCORM 1.2 and 2004
                                case "not attempted": scorm.status("set", "incomplete"); break;

                                //SCORM 2004 only
                                case "unknown" : scorm.status("set", "incomplete"); break;

                                //Additional options, presented here in case you'd like to use them
                                //case "completed"  : break;
                                //case "incomplete" : break;
                                //case "passed"     : break;    //SCORM 1.2 only
                                //case "failed"     : break;    //SCORM 1.2 only
                                //case "browsed"    : break;    //SCORM 1.2 only

                            }

                            //Commit changes
                            scorm.save();

                        }

                    }

                } else {

                    success = false;
                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                }

            } else {

                errorCode = debug.getCode();

                if(errorCode !== null && errorCode !== 0){

                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                } else {

                    trace(traceMsgPrefix +"failed: No response from server.");

                }
            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

          trace(traceMsgPrefix +"aborted: Connection already active.");

     }

     return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.terminate()
   Tells the LMS to terminate the communication session

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.terminate = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        exitStatus = scorm.data.exitStatus,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.terminate ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

             if(scorm.handleExitMode && !exitStatus){

                if(completionStatus !== "completed" && completionStatus !== "passed"){

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "suspend"); break;
                        case "2004": success = scorm.set("cmi.exit", "suspend"); break;
                    }

                } else {

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "logout"); break;
                        case "2004": success = scorm.set("cmi.exit", "normal"); break;
                    }

                }

            }

            //Ensure we persist the data
            success = scorm.save();

            if(success){

                switch(scorm.version){
                    case "1.2" : success = makeBoolean(API.LMSFinish("")); break;
                    case "2004": success = makeBoolean(API.Terminate("")); break;
                }

                if(success){

                    scorm.connection.isActive = false;

                } else {

                    errorCode = debug.getCode();
                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                }

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"aborted: Connection already terminated.");

    }

    return success;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.data functions --------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.get(parameter)
   Requests information from the LMS.

   Parameter: parameter (string, name of the SCORM data model element)
   Returns:   string (the value of the specified data model element)
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.get = function(parameter){

    var value = null,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.get('" +parameter +"') ";

    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

          if(API){

            switch(scorm.version){
                case "1.2" : value = API.LMSGetValue(parameter); break;
                case "2004": value = API.GetValue(parameter); break;
            }

            errorCode = debug.getCode();

            //GetValue returns an empty string on errors
            //If value is an empty string, check errorCode to make sure there are no errors
            if(value !== "" || errorCode === 0){

                //GetValue is successful.
                //If parameter is lesson_status/completion_status or exit status, let's
                //grab the value and cache it so we can check it during connection.terminate()
                switch(parameter){

                    case "cmi.core.lesson_status":
                    case "cmi.completion_status" : scorm.data.completionStatus = value; break;

                    case "cmi.core.exit":
                    case "cmi.exit"     : scorm.data.exitStatus = value; break;

                }

            } else {

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +"\nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

    trace(traceMsgPrefix +" value: " +value);

    return String(value);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.set()
   Tells the LMS to assign the value to the named data model element.
   Also stores the SCO's completion status in a variable named
   pipwerks.SCORM.data.completionStatus. This variable is checked whenever
   pipwerks.SCORM.connection.terminate() is invoked.

   Parameters: parameter (string). The data model element
               value (string). The value for the data model element
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.set = function(parameter, value){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.set('" +parameter +"') ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSSetValue(parameter, value)); break;
                case "2004": success = makeBoolean(API.SetValue(parameter, value)); break;
            }

            if(success){

                if(parameter === "cmi.core.lesson_status" || parameter === "cmi.completion_status"){

                    scorm.data.completionStatus = value;

                }

            } else {

                errorCode = debug.getCode();

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +". \nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

	trace(traceMsgPrefix +" value: " +value);

    return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.save()
   Instructs the LMS to persist all data to this point in the session

   Parameters: None
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.save = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        traceMsgPrefix = "SCORM.data.save failed";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle();

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSCommit("")); break;
                case "2004": success = makeBoolean(API.Commit("")); break;
            }

        } else {

            trace(traceMsgPrefix +": API is null.");

        }

    } else {

        trace(traceMsgPrefix +": API connection is inactive.");

    }

    return success;

};


pipwerks.SCORM.status = function (action, status){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        traceMsgPrefix = "SCORM.getStatus failed",
        cmi = "";

    if(action !== null){

        switch(scorm.version){
            case "1.2" : cmi = "cmi.core.lesson_status"; break;
            case "2004": cmi = "cmi.completion_status"; break;
        }

        switch(action){

            case "get": success = scorm.data.get(cmi); break;

            case "set": if(status !== null){

                            success = scorm.data.set(cmi, status);

                        } else {

                            success = false;
                            trace(traceMsgPrefix +": status was not specified.");

                        }

                        break;

            default      : success = false;
                        trace(traceMsgPrefix +": no valid action was specified.");

        }

    } else {

        trace(traceMsgPrefix +": action was not specified.");

    }

    return success;

};


// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.debug functions -------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getCode
   Requests the error code for the current error state from the LMS

   Parameters: None
   Returns:    Integer (the last error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getCode = function(){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        code = 0;

    if(API){

        switch(scorm.version){
            case "1.2" : code = parseInt(API.LMSGetLastError(), 10); break;
            case "2004": code = parseInt(API.GetLastError(), 10); break;
        }

    } else {

        trace("SCORM.debug.getCode failed: API is null.");

    }

    return code;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getInfo()
   "Used by a SCO to request the textual description for the error code
   specified by the value of [errorCode]."

   Parameters: errorCode (integer).
   Returns:    String.
----------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";


    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetErrorString(errorCode.toString()); break;
            case "2004": result = API.GetErrorString(errorCode.toString()); break;
        }

    } else {

        trace("SCORM.debug.getInfo failed: API is null.");

    }

    return String(result);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getDiagnosticInfo
   "Exists for LMS specific use. It allows the LMS to define additional
   diagnostic information through the API Instance."

   Parameters: errorCode (integer).
   Returns:    String (Additional diagnostic information about the given error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getDiagnosticInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";

    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetDiagnostic(errorCode); break;
            case "2004": result = API.GetDiagnostic(errorCode); break;
        }

    } else {

        trace("SCORM.debug.getDiagnosticInfo failed: API is null.");

    }

    return String(result);

};


// ------------------------------------------------------------------------- //
// --- Shortcuts! ---------------------------------------------------------- //
// ------------------------------------------------------------------------- //

// Because nobody likes typing verbose code.

pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
pipwerks.SCORM.get  = pipwerks.SCORM.data.get;
pipwerks.SCORM.set  = pipwerks.SCORM.data.set;
pipwerks.SCORM.save = pipwerks.SCORM.data.save;
pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;



// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS functions -------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.UTILS.StringToBoolean()
   Converts 'boolean strings' into actual valid booleans.

   (Most values returned from the API are the strings "true" and "false".)

   Parameters: String
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.UTILS.StringToBoolean = function(value){
    var t = typeof value;
    switch(t){
       //typeof new String("true") === "object", so handle objects as string via fall-through.
       //See https://github.com/pipwerks/scorm-api-wrapper/issues/3
       case "object":
       case "string": return (/(true|1)/i).test(value);
       case "number": return !!value;
       case "boolean": return value;
       case "undefined": return null;
       default: return false;
    }
};



/* -------------------------------------------------------------------------
   pipwerks.UTILS.trace()
   Displays error messages when in debug mode.

   Parameters: msg (string)
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.UTILS.trace = function(msg){

     if(pipwerks.debug.isActive){

        if(window.console && window.console.log){
            window.console.log(msg);
        } else {
            //alert(msg);
        }

     }
};

define("extensions/adapt-contrib-spoor/js/scorm/API", function(){});

define ('extensions/adapt-contrib-spoor/js/scorm/wrapper',['require'],function(require) {

	/*
		IMPORTANT: This wrapper uses the Pipwerks SCORM wrapper and should therefore support both SCORM 1.2 and 2004. Ensure any changes support both versions.
	*/

	var ScormWrapper = function() {
		/* configuration */
		this.setCompletedWhenFailed = true;// this only applies to SCORM 2004
		/**
		 * whether to commit each time there's a change to lesson_status or not
		 */
		this.commitOnStatusChange = true;
		/**
		 * how frequently (in minutes) to commit automatically. set to 0 to disable.
		 */
		this.timedCommitFrequency = 10;
		/**
		 * how many times to retry if a commit fails
		 */
		this.maxCommitRetries = 5;
		/**
		 * time (in milliseconds) to wait between retries
		 */
		this.commitRetryDelay = 1000;
		
		/**
		 * prevents commit from being called if there's already a 'commit retry' pending.
		 */
		this.commitRetryPending = false;
		/**
		 * how many times we've done a 'commit retry'
		 */
		this.commitRetries = 0;
		/**
		 * not currently used - but you could include in an error message to show when data was last saved
		 */
		this.lastCommitSuccessTime = null;
		
		this.timedCommitIntervalID = null;
		this.retryCommitTimeoutID = null;
		this.logOutputWin = null;
		this.startTime = null;
		this.endTime = null;
		
		this.lmsConnected = false;
		this.finishCalled = false;
		
		this.logger = Logger.getInstance();
		this.scorm = pipwerks.SCORM;

		this.suppressErrors = false;
        
		if (window.__debug)
			this.showDebugWindow();

		if ((window.API && window.API.__offlineAPIWrapper) || (window.API_1484_11 && window.API_1484_11.__offlineAPIWrapper))
			this.logger.error("Offline SCORM API is being used. No data will be reported to the LMS!");
	};

	// static
	ScormWrapper.instance = null;

	/******************************* public methods *******************************/

	// static
	ScormWrapper.getInstance = function() {
		if (ScormWrapper.instance === null)
			ScormWrapper.instance = new ScormWrapper();
		
		return ScormWrapper.instance;
	};

	ScormWrapper.prototype.getVersion = function() {
		return this.scorm.version;
	};

	ScormWrapper.prototype.setVersion = function(value) {
		this.logger.debug("ScormWrapper::setVersion: " + value);
		this.scorm.version = value;
		/**
		 * stop the pipwerks code from setting cmi.core.exit to suspend/logout when targeting SCORM 1.2.
		 * there doesn't seem to be any tangible benefit to doing this in 1.2 and it can actually cause problems with some LMSes
		 * (e.g. setting it to 'logout' apparently causes Plateau to log the user completely out of the LMS!)
		 * It needs to be on for SCORM 2004 though, otherwise the LMS might not restore the suspend_data
		 */
		this.scorm.handleExitMode = this.isSCORM2004();
	};

	ScormWrapper.prototype.initialize = function() {
		this.logger.debug("ScormWrapper::initialize");
		this.lmsConnected = this.scorm.init();

		if (this.lmsConnected) {
			this.startTime = new Date();
			
			this.initTimedCommit();
		}
		else {
			this.handleError("Course could not connect to the LMS");
		}
		
		return this.lmsConnected;
	};

	/**
	* allows you to check if this is the user's first ever 'session' of a SCO, even after the lesson_status has been set to 'incomplete'
	*/
	ScormWrapper.prototype.isFirstSession = function() {
		return (this.getValue(this.isSCORM2004() ? "cmi.entry" :"cmi.core.entry") === "ab-initio");
	};

	ScormWrapper.prototype.setIncomplete = function() {
		this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "incomplete");

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setCompleted = function() {
		this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "completed");
		
		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setPassed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.completion_status", "completed");
			this.setValue("cmi.success_status", "passed");
		}
		else {
			this.setValue("cmi.core.lesson_status", "passed");
		}

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setFailed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.success_status", "failed");
			
			if(this.setCompletedWhenFailed) {
				this.setValue("cmi.completion_status", "completed");
			}
		}
		else {
			this.setValue("cmi.core.lesson_status", "failed");
		}

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.getStatus = function() {
		var status = this.getValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status");

		switch(status.toLowerCase()) {// workaround for some LMSes (e.g. Arena) not adhering to the all-lowercase rule
			case "passed":
			case "completed":
			case "incomplete":
			case "failed":
			case "browsed":
			case "not attempted":
			case "not_attempted":// mentioned in SCORM 2004 docs but not sure it ever gets used
			case "unknown": //the SCORM 2004 version of not attempted
				return status;
			default:
				this.handleError("ScormWrapper::getStatus: invalid lesson status '" + status + "' received from LMS");
				return null;
		}
	};

	ScormWrapper.prototype.setStatus = function(status) {
		switch (status.toLowerCase()){
			case "incomplete":
				this.setIncomplete();
			break;
			case "completed":
				this.setCompleted();
			break;
			case "passed":
				this.setPassed();
			break;
			case "failed":
				this.setFailed();
			break;
			default:
				this.handleError("ScormWrapper::setStatus: the status '" + status + "' is not supported.");
		}
	};

	ScormWrapper.prototype.getScore = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.score.raw" : "cmi.core.score.raw");
	};

	ScormWrapper.prototype.setScore = function(_score, _minScore, _maxScore) {
		if (this.isSCORM2004()) {
			this.setValue("cmi.score.raw", _score);
			this.setValue("cmi.score.min", _minScore);
			this.setValue("cmi.score.max", _maxScore);
			this.setValue("cmi.score.scaled", _score / 100);
		}
		else {
			this.setValue("cmi.core.score.raw", _score);

			if(this.isSupported("cmi.core.score.min")) this.setValue("cmi.core.score.min", _minScore);

			if(this.isSupported("cmi.core.score.max")) this.setValue("cmi.core.score.max", _maxScore);
		}
	};

	ScormWrapper.prototype.getLessonLocation = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location");
	};

	ScormWrapper.prototype.setLessonLocation = function(_location) {
		this.setValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location", _location);
	};

	ScormWrapper.prototype.getSuspendData = function() {
		return this.getValue("cmi.suspend_data");
	};

	ScormWrapper.prototype.setSuspendData = function(_data) {
		this.setValue("cmi.suspend_data", _data);
	};

	ScormWrapper.prototype.getStudentName = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.learner_name" : "cmi.core.student_name");
	};

	ScormWrapper.prototype.getStudentId = function(){
		return this.getValue(this.isSCORM2004() ? "cmi.learner_id":"cmi.core.student_id");
	};

	ScormWrapper.prototype.commit = function() {
		this.logger.debug("ScormWrapper::commit");
		
		if (this.lmsConnected) {
			if (this.commitRetryPending) {
				this.logger.debug("ScormWrapper::commit: skipping this commit call as one is already pending.");
			}
			else {
				if (this.scorm.save()) {
					this.commitRetries = 0;
					this.lastCommitSuccessTime = new Date();
				}
				else {
					if (this.commitRetries < this.maxCommitRetries && !this.finishCalled) {
						this.commitRetries++;
						this.initRetryCommit();
					}
					else {
						var _errorCode = this.scorm.debug.getCode();

						var _errorMsg = "Course could not commit data to the LMS";
						_errorMsg += "\nError " + _errorCode + ": " + this.scorm.debug.getInfo(_errorCode);
						_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);

						this.handleError(_errorMsg);
					}
				}
			}
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.finish = function() {
		this.logger.debug("ScormWrapper::finish");
		
		if (this.lmsConnected && !this.finishCalled) {
			this.finishCalled = true;
			
			if(this.timedCommitIntervalID !== null) {
				window.clearInterval(this.timedCommitIntervalID);
			}
			
			if(this.commitRetryPending) {
				window.clearTimeout(this.retryCommitTimeoutID);
				this.commitRetryPending = false;
			}
			
			if (this.logOutputWin && !this.logOutputWin.closed) {
				this.logOutputWin.close();
			}
			
			this.endTime = new Date();
			
			if (this.isSCORM2004()) {
				this.scorm.set("cmi.session_time", this.convertToSCORM2004Time(this.endTime.getTime() - this.startTime.getTime()));
			}
			else {
				this.scorm.set("cmi.core.session_time", this.convertToSCORM12Time(this.endTime.getTime() - this.startTime.getTime()));
				this.scorm.set("cmi.core.exit", "");
			}
			
			// api no longer available from this point
			this.lmsConnected = false;
			
			if (!this.scorm.quit()) {
				this.handleError("Course could not finish");
			}
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.recordInteraction = function(id, response, correct, latency, type) {
		if(this.isSupported("cmi.interactions._count")) {
			switch(type) {
				case "choice":
					this.recordInteractionMultipleChoice.apply(this, arguments);
					break;

				case "matching":
					this.recordInteractionMatching.apply(this, arguments);
					break;

				case "numeric":
					this.isSCORM2004() ? this.recordInteractionScorm2004.apply(this, arguments) : this.recordInteractionScorm12.apply(this, arguments);
					break;

				case "fill-in":
					this.recordInteractionFillIn.apply(this, arguments);
					break;

				default:
					console.error("ScormWrapper.recordInteraction: unknown interaction type of '" + type + "' encountered...");
			}
		}
		else {
			this.logger.info("ScormWrapper::recordInteraction: cmi.interactions are not supported by this LMS...");
		}
	};

	/****************************** private methods ******************************/
	ScormWrapper.prototype.getValue = function(_property) {
		this.logger.debug("ScormWrapper::getValue: _property=" + _property);

		if(this.finishCalled) {
			this.logger.debug("ScormWrapper::getValue: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _value = this.scorm.get(_property);
			var _errorCode = this.scorm.debug.getCode();
			var _errorMsg = "";
			
			if (_errorCode !== 0) {
				if (_errorCode === 403) {
					this.logger.warn("ScormWrapper::getValue: data model element not initialized");
				}
				else {
					_errorMsg += "Course could not get " + _property;
					_errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
					_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);
					
					this.handleError(_errorMsg);
				}
			}
			this.logger.debug("ScormWrapper::getValue: returning " + _value);
			return _value + "";
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.setValue = function(_property, _value) {
		this.logger.debug("ScormWrapper::setValue: _property=" + _property + " _value=" + _value);

		if(this.finishCalled) {
			this.logger.debug("ScormWrapper::setValue: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _success = this.scorm.set(_property, _value);
			var _errorCode = this.scorm.debug.getCode();
			var _errorMsg = "";
			
			if (!_success) {
				/*
				* Some LMSes have an annoying tendency to return false from a set call even when it actually worked fine.
				* So, we should throw an error _only_ if there was a valid error code...
				*/
				if(_errorCode !== 0) {
					_errorMsg += "Course could not set " + _property + " to " + _value;
					_errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
					_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);
					
					this.handleError(_errorMsg);
				}
				else {
					this.logger.warn("ScormWrapper::setValue: LMS reported that the 'set' call failed but then said there was no error!");
				}
			}
			
			return _success;
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	/**
	* used for checking any data field that is not 'LMS Mandatory' to see whether the LMS we're running on supports it or not.
	* Note that the way this check is being performed means it wouldn't work for any element that is
	* 'write only', but so far we've not had a requirement to check for any optional elements that are.
	*/
	ScormWrapper.prototype.isSupported = function(_property) {
		this.logger.debug("ScormWrapper::isSupported: _property=" + _property);

		if(this.finishCalled) {
			this.logger.debug("ScormWrapper::isSupported: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _value = this.scorm.get(_property);
			var _errorCode = this.scorm.debug.getCode();
			
			return (_errorCode === 401 ? false : true);
		}
		else {
			this.handleError("Course is not connected to the LMS");
			return false;
		}
	};

	ScormWrapper.prototype.initTimedCommit = function() {
		this.logger.debug("ScormWrapper::initTimedCommit");
		
		if(this.timedCommitFrequency > 0) {
			var delay = this.timedCommitFrequency * (60 * 1000);
			this.timedCommitIntervalID = window.setInterval(_.bind(this.commit, this), delay);
		}
	};

	ScormWrapper.prototype.initRetryCommit = function() {
		this.logger.debug("ScormWrapper::initRetryCommit " + this.commitRetries + " out of " + this.maxCommitRetries);
		
		this.commitRetryPending = true;// stop anything else from calling commit until this is done
		
		this.retryCommitTimeoutID = window.setTimeout(_.bind(this.doRetryCommit, this), this.commitRetryDelay);
	};

	ScormWrapper.prototype.doRetryCommit = function() {
		this.logger.debug("ScormWrapper::doRetryCommit");

		this.commitRetryPending = false;

		this.commit();
	};

	ScormWrapper.prototype.handleError = function(_msg) {
		this.logger.error(_msg);
		
		if (!this.suppressErrors && (!this.logOutputWin || this.logOutputWin.closed) && confirm("An error has occured:\n\n" + _msg + "\n\nPress 'OK' to view debug information to send to technical support."))
			this.showDebugWindow();
	};

	ScormWrapper.prototype.getInteractionCount = function(){
		var count = this.getValue("cmi.interactions._count");
		return count === "" ? 0 : count;
	};
	
	ScormWrapper.prototype.recordInteractionScorm12 = function(id, response, correct, latency, type) {
		
		id = this.trim(id);

		var cmiPrefix = "cmi.interactions." + this.getInteractionCount();
		
		this.setValue(cmiPrefix + ".id", id);
		this.setValue(cmiPrefix + ".type", type);
		this.setValue(cmiPrefix + ".student_response", response);
		this.setValue(cmiPrefix + ".result", correct ? "correct" : "wrong");
		if (latency !== null && latency !== undefined) this.setValue(cmiPrefix + ".latency", this.convertToSCORM12Time(latency));
		this.setValue(cmiPrefix + ".time", this.getCMITime());
	};


	ScormWrapper.prototype.recordInteractionScorm2004 = function(id, response, correct, latency, type) {

		id = this.trim(id);

		var cmiPrefix = "cmi.interactions." + this.getInteractionCount();
		
		this.setValue(cmiPrefix + ".id", id);
		this.setValue(cmiPrefix + ".type", type);
		this.setValue(cmiPrefix + ".learner_response", response);
		this.setValue(cmiPrefix + ".result", correct ? "correct" : "incorrect");
		if (latency !== null && latency !== undefined) this.setValue(cmiPrefix + ".latency", this.convertToSCORM2004Time(latency));
		this.setValue(cmiPrefix + ".timestamp", this.getISO8601Timestamp());
	};


	ScormWrapper.prototype.recordInteractionMultipleChoice = function(id, response, correct, latency, type) {
		
		if(this.isSCORM2004()) {
			response = response.replace(/,|#/g, "[,]");
		} else {
			response = response.replace(/#/g, ",");
		}
		
		var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

		scormRecordInteraction.call(this, id, response, correct, latency, type);
	};

	
	ScormWrapper.prototype.recordInteractionMatching = function(id, response, correct, latency, type) {

		response = response.replace(/#/g, ",");

		if(this.isSCORM2004()) {
			response = response.replace(/,/g, "[,]");
			response = response.replace(/\./g, "[.]");
		}
		
		var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

		scormRecordInteraction.call(this, id, response, correct, latency, type);
	};


	ScormWrapper.prototype.recordInteractionFillIn = function(id, response, correct, latency, type) {
		
		var maxLength = this.isSCORM2004() ? 250 : 255;

		if(response.length > maxLength) {
			response = response.substr(0, maxLength);

			this.logger.warn("ScormWrapper::recordInteractionFillIn: response data for " + id + " is longer than the maximum allowed length of " + maxLength + " characters; data will be truncated to avoid an error.");
		}

		var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

		scormRecordInteraction.call(this, id, response, correct, latency, type);
	};

	ScormWrapper.prototype.showDebugWindow = function() {
		
		if (this.logOutputWin && !this.logOutputWin.closed) {
			this.logOutputWin.close();
		}
		
		this.logOutputWin = window.open("log_output.html", "Log", "width=600,height=300,status=no,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes,location=yes,top=0,left=0");
		
		if (this.logOutputWin)
			this.logOutputWin.focus();
		
		return;
	};

	ScormWrapper.prototype.convertToSCORM12Time = function(msConvert) {
		
		var msPerSec = 1000;
		var msPerMin = msPerSec * 60;
		var msPerHour = msPerMin * 60;

		var ms = msConvert % msPerSec;
		msConvert = msConvert - ms;

		var secs = msConvert % msPerMin;
		msConvert = msConvert - secs;
		secs = secs / msPerSec;

		var mins = msConvert % msPerHour;
		msConvert = msConvert - mins;
		mins = mins / msPerMin;

		var hrs = msConvert / msPerHour;

		if(hrs > 9999) {
			return "9999:99:99.99";
		}
		else {
			var str = [this.padWithZeroes(hrs,4), this.padWithZeroes(mins, 2), this.padWithZeroes(secs, 2)].join(":");
			return (str + '.' + Math.floor(ms/10));
		}
	};

	/**
	* Converts milliseconds into the SCORM 2004 data type 'timeinterval (second, 10,2)'
	* this will output something like 'P1DT3H5M0S' which indicates a period of time of 1 day, 3 hours and 5 minutes
	* or 'PT2M10.1S' which indicates a period of time of 2 minutes and 10.1 seconds
	*/
	ScormWrapper.prototype.convertToSCORM2004Time = function(msConvert) {
		var csConvert = Math.floor(msConvert / 10);
		var csPerSec = 100;
		var csPerMin = csPerSec * 60;
		var csPerHour = csPerMin * 60;
		var csPerDay = csPerHour * 24;

		var days = Math.floor(csConvert/ csPerDay);
		csConvert -= days * csPerDay;
		days = days ? days + "D" : "";

		var hours = Math.floor(csConvert/ csPerHour);
		csConvert -= hours * csPerHour;
		hours = hours ? hours + "H" : "";

		var mins = Math.floor(csConvert/ csPerMin);
		csConvert -= mins * csPerMin;
		mins = mins ? mins + "M" : "";

		var secs = Math.floor(csConvert/ csPerSec);
		csConvert -= secs * csPerSec;
		secs = secs ? secs : "0";

		var cs = csConvert;
		cs = cs ? "." + cs : "";
		
		var seconds = secs + cs + "S";
		
		var hms = [hours,mins,seconds].join("");
		
		return "P" + days + "T" + hms;
	};

	ScormWrapper.prototype.getCMITime = function() {
		
		var date = new Date();

		var hours = this.padWithZeroes(date.getHours(),2);
		var min = this.padWithZeroes(date.getMinutes(),2);
		var sec = this.padWithZeroes(date.getSeconds(),2);

		return [hours, min, sec].join(":");
	};

	ScormWrapper.prototype.getISO8601Timestamp = function() {
	
		var date = new Date();
		
		var ymd = [
			date.getFullYear(),
			this.padWithZeroes(date.getMonth()+1,2),
			this.padWithZeroes(date.getDate(),2)
		].join("-");

		var hms = [
			this.padWithZeroes(date.getHours(),2),
			this.padWithZeroes(date.getMinutes(),2),
			this.padWithZeroes(date.getSeconds(),2)
		].join(":");

		return ymd + "T" + hms;
	};

	ScormWrapper.prototype.padWithZeroes = function(numToPad, padBy) {

		var len = padBy;

		while(--len){ numToPad = "0" + numToPad; }

		return numToPad.slice(-padBy);
	};

	ScormWrapper.prototype.trim = function(str) {
		return str.replace(/^\s*|\s*$/g, "");
	};

	ScormWrapper.prototype.isSCORM2004 = function() {
		return this.scorm.version === "2004";
	};

	return ScormWrapper;
});

Logger = function() {
	this.logArr = new Array();
	this.registeredViews = new Array();
};

if (!Date.now) {
    Date.now = function() { return new Date().getTime(); }
}

// static
Logger.instance = null;
Logger.LOG_TYPE_INFO = 0;
Logger.LOG_TYPE_WARN = 1;
Logger.LOG_TYPE_ERROR = 2;
Logger.LOG_TYPE_DEBUG = 3;

Logger.getInstance = function() {
	if (Logger.instance == null)
		Logger.instance = new Logger();
	return Logger.instance;
};

Logger.prototype.getEntries = function() {
	return this.logArr;
};

Logger.prototype.getLastEntry = function() {
	return this.logArr[this.logArr.length - 1];
};

Logger.prototype.info = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_INFO, time:Date.now()};
	this.updateViews();
};

Logger.prototype.warn = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_WARN, time:Date.now()};
	this.updateViews();
};

Logger.prototype.error = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_ERROR, time:Date.now()};
	this.updateViews();
};

Logger.prototype.debug = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_DEBUG, time:Date.now()};
	this.updateViews();
};

//register a view
Logger.prototype.registerView = function(_view) {
	this.registeredViews[this.registeredViews.length] = _view;
};

//unregister a view
Logger.prototype.unregisterView = function(_view) {
	for (var i = 0; i < this.registeredViews.length; i++)
		if (this.registeredViews[i] == _view) {
			this.registeredViews.splice(i, 1);
			i--;
		}
};

// update all views
Logger.prototype.updateViews = function() {
	for (var i = 0; i < this.registeredViews.length; i++) {
		if (this.registeredViews[i])
			this.registeredViews[i].update(this);
	}
};
define("extensions/adapt-contrib-spoor/js/scorm/logger", function(){});

define('extensions/adapt-contrib-spoor/js/scorm',[
	'./scorm/API',
 	'./scorm/wrapper',
	'./scorm/logger'
], function(API, wrapper, logger) {

	//Load and prepare SCORM API

	return wrapper.getInstance();

});
define('extensions/adapt-contrib-spoor/js/serializers/default',[
    'core/js/adapt'
], function (Adapt) {

    //Captures the completion status of the blocks
    //Returns and parses a '1010101' style string

    var serializer = {
        serialize: function () {
            return this.serializeSaveState('_isComplete');
        },

        serializeSaveState: function(attribute) {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
            }

            var excludeAssessments = Adapt.config.get('_spoor') && Adapt.config.get('_spoor')._tracking && Adapt.config.get('_spoor')._tracking._excludeAssessments;

            // create the array to be serialised, pre-populated with dashes that represent unused tracking ids - because we'll never re-use a tracking id in the same course
            var data = [];
            var length = Adapt.course.get('_latestTrackingId') + 1;
            for (var i = 0; i < length; i++) {
                data[i] = "-";
            }

            // now go through all the blocks, replacing the appropriate dashes with 0 (incomplete) or 1 (completed) for each of the blocks
            _.each(Adapt.blocks.models, function(model, index) {
                var _trackingId = model.get('_trackingId'),
                    isPartOfAssessment = model.getParent().get('_assessment'),
                    state = model.get(attribute) ? 1: 0;

                if(excludeAssessments && isPartOfAssessment) {
                    state = 0;
                }

                if (_trackingId === undefined) {
                    var message = "Block '" + model.get('_id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                    console.error(message);
                } else {
                    data[_trackingId] = state;
                }
            }, this);

            return data.join("");
        },

        deserialize: function (completion) {

            _.each(this.deserializeSaveState(completion), function(state, blockTrackingId) {
                if (state === 1) {
                    this.markBlockAsComplete(Adapt.blocks.findWhere({_trackingId: blockTrackingId}));
                }
            }, this);

        },    

        deserializeSaveState: function (string) {
            var completionArray = string.split("");

            for (var i = 0; i < completionArray.length; i++) {
                if (completionArray[i] === "-") {
                    completionArray[i] = -1;
                } else {
                    completionArray[i] = parseInt(completionArray[i], 10);
                }
            }

            return completionArray;
        },

        markBlockAsComplete: function(block) {
            if (!block) {
                return;
            }
        
            block.getChildren().each(function(child) {
                child.set('_isComplete', true);
            }, this);
        }

    };

    return serializer;
});

//https://raw.githubusercontent.com/oliverfoster/SCORMSuspendDataSerializer 2015-06-27
(function(_) {

	function toPrecision(number, precision) {
		if (precision === undefined) precision = 2
		var multiplier = 1 * Math.pow(10, precision);
		return Math.round(number * multiplier) / multiplier;
	}

	function BinaryToNumber(bin, length) {
		return parseInt(bin.substr(0, length), 2);
	}

	function NumberToBinary(number, length) {
		return Padding.fillLeft( number.toString(2), length );
	}

	var Padding = {
		addLeft: function PaddingAddLeft(str, x , char) {
			char = char || "0";
			return (new Array( x + 1)).join(char) + str;
		},
		addRight: function PaddingAddRight(str, x, char) {
			char = char || "0";
			return  str + (new Array( x + 1)).join(char);
		},
		fillLeft: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillRight: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockLeft: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockRight: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		}
	};

	function Base64() {
		switch (arguments.length) {
		case 1:
			var firstArgumentType = typeof arguments[0];
			switch (firstArgumentType) {
			case "number":
				return Base64._indexes[arguments[0]];
			case "string":
				return Base64._chars[arguments[0]];
			default:
				throw "Invalid arguments type";
			}
		case 2:
			var char = arguments[0];
			var index = arguments[1];
			Base64._chars[char] = index;
			Base64._indexes[index] = char;
			return;
		default:
			throw "Invalid number of arguments";
		}
	}
	Base64._chars = {};
	Base64._indexes = {};
	(function() {
		var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		for (var i = 0, l = alphabet.length; i<l; i++) {
			Base64(alphabet[i], i);
		}
	})();


	function DataType() {
		switch (arguments.length) {
		case 1:
			switch (typeof  arguments[0]) {
			case "object":
				var item = arguments[0]
				if (DataType._types[item.type] === undefined) DataType._types[item.type] = [];
				DataType._types[item.type].push(item);
				item.index = DataType._indexes.length
				DataType._indexes.push(item);
				DataType[item.name] = item;
				return;
			case "string":
				return DataType.getName(arguments[0]);
			case "number":
				return DataType.getIndex(arguments[0]);
			default:
				throw "Argument type not allowed";
			}
		default:
			throw "Too many arguments";
		}
		
	}
	DataType.VARIABLELENGTHDESCRIPTORSIZE = 8;
	DataType._types = {};
	DataType._indexes = [];
	DataType.getName = function DataTypeGetName(name) {
		if (DataType[name])
			return DataType[name];
		throw "Type name not found '"+name+"'";
	};
	DataType.getIndex = function DataTypeGetIndex(index) {
		if (DataType._indexes[index])
			return DataType._indexes[index];
		throw "Type index not found '"+index+"'";
	};
	DataType.getTypes = function DataTypeGetTypes(type) {
		if (DataType._types[type])
			return DataType._types[type];
		throw "Type not found '"+type+"'";
	};
	DataType.checkBounds = function DataTypeCheckBounds(name, number) {
		var typeDef = DataType(name);
		if (number > typeDef.max) throw name + " value is larger than "+typeDef.max;
		if (number < typeDef.min) throw name + " value is smaller than "+typeDef.min;
	};
	DataType.getNumberType = function DataTypeGetNumberType(number) {
		var isDecimal = (number - Math.floor(number)) !== 0;
		var numberDataTypes = DataType.getTypes("number");
		for (var t = 0, type; type = numberDataTypes[t++];) {
			if (number <= type.max && number >= type.min && (!isDecimal || isDecimal == type.decimal) ) {
				return type;
			}
		}
	};
	DataType.getVariableType = function DataTypeGetVariableType(variable) {
		var variableNativeType = variable instanceof Array ? "array" : typeof variable;
		var variableDataType;

		switch(variableNativeType) {
		case "number":
			variableDataType = DataType.getNumberType(variable);
			break;
		case "string":
			variableDataType = DataType.getName("string");
			break;
		default: 
			var supportedItemDataTypes = DataType.getTypes(variableNativeType);
			switch (supportedItemDataTypes.length) {
			case 1:
				variableDataType = supportedItemDataTypes[0];
				break;
			default:
				throw "Type not found '"+variableNativeType+"'";
			}
		}
	
		if (!variableDataType) throw "Cannot assess type '"+variableNativeType+"'";

		return variableDataType;
	};
	DataType.getArrayType = function getArrayType(arr) {
		var foundItemTypes = [];

		for (var i = 0, l = arr.length; i < l; i++) {
			var item = arr[i];
			var itemDataType = DataType.getVariableType(item);

			if (_.findWhere(foundItemTypes, { name: itemDataType.name })) continue;
	
			foundItemTypes.push(itemDataType);
		}

		switch (foundItemTypes.length) {
		case 0:
			throw "Cannot determine array data types";
		case 1:
			//single value type
		 	return foundItemTypes[0];
		default: 
			//many value types
			var nativeTypeNames = _.pluck(foundItemTypes, 'type');
			var uniqueNativeTypeNames = _.uniq(nativeTypeNames);
			var hasManyNativeTypes = (uniqueNativeTypeNames.length > 1);

			if (hasManyNativeTypes) return DataType("variable"); //multiple types in array

			//single native type in array, multiple datatype lengths
			switch (uniqueNativeTypeNames[0]) {
			case "number":
				var foundDecimal = _.findWhere(foundItemTypes, { decimal: true});
				if (foundDecimal) return foundDecimal;
				return _.max(foundItemTypes, function(type) {
					return type.max;
				});
			}

			throw "Unsupported data types";
		}
		
	};
	(function() {
		var types = [
			{
				"size": "fixed",
				"length": 1,
				"name": "boolean",
				"type": "boolean"
			},
			{
				"max": 15,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 4,
				"name": "half",
				"type": "number"
			},
			{
				"max": 255,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 8,
				"name": "byte",
				"type": "number"
			},
			{
				"max": 65535,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 16,
				"name": "short",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 32,
				"name": "long",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": -4294967295,
				"decimal": true,
				"precision": 2,
				"size": "variable",
				"name": "double",
				"type": "number"
			},
			{
				"name": "base16",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "base64",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "array",
				"size": "variable",
				"type": "array"
			},
			{
				"name": "variable",
				"size": "variable",
				"type": "variable"
			},
			{
				"name": "string",
				"size": "variable",
				"type": "string"
			}
		];
		for (var i = 0, type; type = types[i++];) {
			DataType(type);
		}
	})();

	

	function Converter(fromType, toType) {
		fromType = Converter.translateTypeAlias(fromType);
		toType = Converter.translateTypeAlias(toType);

		var args = [].slice.call(arguments, 2);

		if (fromType != "binary" && toType != "binary") {
			if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
			if (!Converter._converters[fromType]['binary']) throw "Type not found 'binary'";
			
			var bin = Converter._converters[fromType]['binary'].call(this, args[0], Converter.WRAPOUTPUT);

			if (!Converter._converters['binary'][toType]) throw "Type not found '"+toType+"'";

			return Converter._converters['binary'][toType].call(this, bin, Converter.WRAPOUTPUT);
		}

		if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
		if (!Converter._converters[fromType][toType]) throw "Type not found '" + toType + "'";

		return Converter._converters[fromType][toType].call(this, args[0], Converter.WRAPOUTPUT);
	}
	Converter.WRAPOUTPUT = false;
	Converter.translateTypeAlias = function ConverterTranslateTypeAlias(type) {
		type = type.toLowerCase();
		for (var Type in Converter._typeAliases) {
			if (Type == type || (" "+Converter._typeAliases[Type].join(" ")+" ").indexOf(" "+type+" ") >= 0 ) return Type;
		}
		throw "Type not found '" + type + "'";
	};
	Converter._typeAliases = {
		"base64": [ "b64" ],
		"base16" : [ "hex", "b16" ],
		"double": [ "dbl", "decimal", "d" ],
		"long": [ "lng", "l" ],
		"short": [ "s" ],
		"byte" : [ "b" ],
		"half": [ "h" ],
		"number": [ "num", "n" ],
		"binary": [ "bin" ],
		"boolean": [ "bool" ],
		"array": [ "arr" ]
	};
	Converter._variableWrapLength = function ConverterVariableWrapLength(bin) {
		var variableLength = bin.length;
		var binLength = NumberToBinary(variableLength, DataType.VARIABLELENGTHDESCRIPTORSIZE)

		return binLength + bin;
	};
	Converter._variableLength = function ConverterVariableLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );
		return variableLength;
	};
	Converter._variableUnwrapLength = function ConverterVariableUnwrapLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );

		return bin.substr( VLDS, variableLength);
	};
	Converter._converters = {
		"base64": {
			"binary": function ConverterBase64ToBinary(base64) { //TODO PADDING... ?
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 6);
				var paddingLength = BinaryToNumber(binFirstByte, 6);

			    var bin = "";
			    for (var i = 0, ch; ch = base64[i++];) {
			        var block = Base64(ch).toString(2);
			        block = Padding.fillLeft(block, 6);
			        bin += block;
			    }
			    bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"base16": {
			"binary": function ConverterBase16ToBinary(hex) {
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 4);
				var paddingLength = BinaryToNumber(binFirstByte, 4);

			    var bin = "";
			    for (var i = 0, ch; ch = hex[i++];) {
			        var block = parseInt(ch, 16).toString(2);
			        block = Padding.fillLeft(block, 4);
			        bin += block;
			    }

			     bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"double": {
			"binary": function ConverterDoubleToBinary(dbl, wrap) {
				var typeDef = DataType("double");
				DataType.checkBounds("double", dbl);

				dbl = toPrecision(dbl, typeDef.precision);

				var dblStr = dbl.toString(10);

				var isMinus = dbl < 0;
			
				var baseStr, exponentStr, highStr, lowStr, decimalPosition, hasDecimal;

				
				var exponentPos = dblStr.indexOf("e");
				if (exponentPos > -1) {
					//exponential float representation "nE-x"
					baseStr = dblStr.substr(0, exponentPos);
					exponentStr = Math.abs(dblStr.substr(exponentPos+1));

					if (isMinus) baseStr = baseStr.substr(1);

					decimalPosition = baseStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);

					if (hasDecimal) {
						highStr = baseStr.substr(0, decimalPosition);
						lowStr = baseStr.substr(decimalPosition+1);

						exponentStr = (Math.abs(exponentStr) + lowStr.length);

						baseStr = highStr + lowStr;
					}

				} else {
					//normal long float representation "0.00000000"
					baseStr = dblStr;
					exponentStr = "0";

					if (isMinus) dblStr = dblStr.substr(1);

					decimalPosition = dblStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);
					if (hasDecimal) {
						highStr = dblStr.substr(0, decimalPosition);
						lowStr = dblStr.substr(decimalPosition+1);

						exponentStr = (lowStr.length);
						if (highStr == "0") {
							baseStr = parseInt(lowStr, 10).toString(10);
						} else {
							baseStr = highStr + lowStr;
						}
					} else {
						baseStr = dblStr;
					}

				}

				var bin = [];

				var binLong = Padding.fillBlockLeft (parseInt(baseStr, 10).toString(2), 4);
				var binMinus = isMinus ? "1" : "0";
				var binExponent = Padding.fillLeft( parseInt(exponentStr, 10).toString(2), 7);
				
				bin.push( binMinus );
				bin.push( binExponent );
				bin.push( binLong );

				if (wrap === false) {
					return bin.join("");
				} else {
					return Converter._variableWrapLength(bin.join(""));
				}
			}
		},
		"long": {
			"binary": function ConverterLongToBinary(value) {
				var typeDef = DataType("long");
				DataType.checkBounds("long", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"short": {
			"binary": function ConverterShortToBinary(value) {
				var typeDef = DataType("short");
				DataType.checkBounds("short", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"byte": {
			"binary": function ConverterByteToBinary(value) {
				var typeDef = DataType("byte");
				DataType.checkBounds("byte", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"half": {
			"binary": function ConverterHalfToBinary(value) {
				var typeDef = DataType("half");
				DataType.checkBounds("half", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"boolean": {
			"binary": function ConverterBooleanToBinary(bool) {
				return bool ? "1" : "0";
			},
		},
		"array": {
			"binary": function ConverterArrayToBinary(arr, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");
				var arrayItemType = DataType.getArrayType(arr);
				var isVariableArray = arrayItemType.name == "vairable";

				if (isVariableArray) {
					var bin = half2bin(15);
					//variable array
					return bin;
				} else {
					var binArrayIdentifier = Converter._converters['half']['binary'](arrayItemType.index);

					var binItemsArray = [];
					for (var i = 0, l = arr.length; i < l; i++) {
						var item = arr[i];
						var binItem = Converter._converters[arrayItemType.name]['binary'](item);
						//console.log("binItem", binItem);
						binItemsArray.push( binItem );
					}

					var binItems = binItemsArray.join("");

					var paddingLength = 0;
					if (binItems.length % 4) paddingLength = 4 - (binItems.length % 4);
					var binPaddingLen = NumberToBinary(paddingLength, 2);

					var binPadding = (new Array(paddingLength+1)).join("0");

					var bin = [];
					bin.push(binArrayIdentifier);
					bin.push(binPaddingLen);
					bin.push(binPadding);
					bin.push(binItems);

					var finished = bin.join("");
					//console.log("unwrapped", finished);

					if (wrap === false) return finished;

					var wrapped = Converter._variableWrapLength( finished);
					//console.log("wrapped", wrapped);

					return wrapped;
				}

			}
		},
		"binary": {
			"array": function ConverterBinaryToArray(bin, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");

				//console.log("wrapped", bin);
				if (wrap !== false)
					bin = Converter._variableUnwrapLength( bin);
				//console.log("unwrapped", bin);

				var binArrayIdentifier = bin.substr(0, 4);
				var binPaddingLen = bin.substr(4 , 2);

				var arrayIdentifier = Converter._converters['binary'][ 'half' ]( binArrayIdentifier );
				var paddingLength = BinaryToNumber( binPaddingLen, 2 );

				var dataStart = 4 + 2 + paddingLength;
				var dataLength = bin.length - dataStart;

				var binItems = bin.substr(dataStart, dataLength );

				var arrayItemType = DataType(arrayIdentifier);
				var isVariableArray = arrayItemType.name == "variable";

				var rtn = [];
				if (isVariableArray) {

				} else {
					var hasVariableLengthChildren = arrayItemType.size == "variable";
					if (hasVariableLengthChildren) {
						var VLDS = DataType.VARIABLELENGTHDESCRIPTORSIZE;
						while ( binItems != "" ) {
							
							var variableLength = Converter._variableLength( binItems );
							var binItem = binItems.substr(0, VLDS + variableLength);
							binItems = binItems.substr(VLDS+variableLength);
							//console.log("binItem", binItem, BinaryToNumber(binItem, 16));

							rtn.push( Converter._converters['binary'][ arrayItemType.name ]( binItem) );
						}
					} else {
						while ( binItems != "" ) {
							var binItem = binItems.substr(0, arrayItemType.length);
							binItems = binItems.substr(arrayItemType.length);

							rtn.push( Converter._converters['binary'][ arrayItemType.name ](binItem) );
						}
					}

				}


				return rtn;

			},
			"base64": function ConverterBinaryToBase64(bin) { //TODO PADDING NOT GOOD
				var paddingLength = 0;
				if (bin.length % 6) paddingLength = 6 - (bin.length % 6);
				binPaddingLen = NumberToBinary(paddingLength, 6);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

				var binLength = bin.length;
			    var base64 = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*6 >= binLength) break;
			     
			        var block = bin.substr(b*6,6);
			        base64 += Base64(parseInt(block, 2));
			    }

			    return base64;
			},
			"base16": function ConverterBinaryToBase16(bin) {
				var paddingLength = 0;
				if (bin.length % 4) paddingLength = 4 - (bin.length % 4);
				binPaddingLen = NumberToBinary(paddingLength, 4);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

			    var binLength = bin.length;
			    var hex = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*4 >= binLength) break;
			     
			        var block = bin.substr(b*4,4);
			        hex += parseInt(block, 2).toString(16);
			    }
			    return hex;
			},
			"double": function ConverterBinaryToDouble(bin, wrap) {
				var typeDef = DataType("double");
				
				if (wrap !== false)
					bin = Converter._variableUnwrapLength(bin);

				var isMinus = bin.substr(0 ,1) == 1;

				var exponentByte = parseInt("0" + bin.substr(1, 7), 2);
				var baseLong = parseInt( bin.substr(8, bin.length), 2);

				var dbl = parseFloat(baseLong+"E-"+exponentByte, 10);
				if (isMinus) dbl = dbl * -1;

				return dbl;
			},
			"long": function ConverterBinaryToLong(bin) {
				return parseInt(bin.substr(0, 32), 2);
			},
			"short": function ConverterBinaryToShort(bin) {
				return parseInt(bin.substr(0, 16), 2);
			},
			"byte": function ConverterBinaryToByte(bin) {
				return parseInt(bin.substr(0, 8), 2);
			},
			"half": function ConverterBinaryToHalf(bin) {
				return parseInt(bin.substr(0, 4), 2);
			},
			"boolean": function ConverterBinaryToBoolean(bin) {
				return bin.substr(0,1) == "1" ? true: false;
			},
			"number": function ConverterBinaryToNumber(bin) {
				return parseInt(bin, 2);
			}
		}
	};
	
	window.SCORMSuspendData = {
		serialize: function SCORMSuspendDataSerialize(arr) {
			return Converter ("array", "base64", arr);
		},
		deserialize: function SCORMSuspendDataDeserialize(base64) {
			return Converter("base64", "array", base64);
		},
		Base64: Base64,
		Converter: Converter,
		DataType: DataType
	};


})(_);

define("extensions/adapt-contrib-spoor/js/serializers/scormSuspendDataSerializer", function(){});

define('extensions/adapt-contrib-spoor/js/serializers/questions',[
    'core/js/adapt',
    './scormSuspendDataSerializer'
], function (Adapt) {

    //Captures the completion status and user selections of the question components
    //Returns and parses a base64 style string
    var includes = {
        "_isQuestionType": true,
        "_isResetOnRevisit": false
    };

    var serializer = {
        serialize: function () {
            return this.serializeSaveState();
        },

        serializeSaveState: function() {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
                return "";
            }

            var rtn = "";
            try {
                var data = this.captureData();
                if (data.length === 0) return "";
                rtn = SCORMSuspendData.serialize(data);
            } catch(e) {
                console.error(e);
            }

            return rtn;
        },

        captureData: function() {
            var data = [];
            
            var trackingIds = Adapt.blocks.pluck("_trackingId");
            var blocks = {};
            var countInBlock = {};

            for (var i = 0, l = trackingIds.length; i < l; i++) {

                var trackingId = trackingIds[i];
                var blockModel = Adapt.blocks.findWhere({_trackingId: trackingId });
                var componentModels = blockModel.getChildren().where(includes);

                for (var c = 0, cl = componentModels.length; c < cl; c++) {

                    var component = componentModels[c].toJSON();
                    var blockId = component._parentId;

                    if (!blocks[blockId]) {
                        blocks[blockId] = blockModel.toJSON();
                    }

                    var block = blocks[blockId];
                    if (countInBlock[blockId] === undefined) countInBlock[blockId] = -1;
                    countInBlock[blockId]++;

                    var blockLocation = countInBlock[blockId];

                    if (component['_isInteractionComplete'] === false || component['_isComplete'] === false) {
                        //if component is not currently complete skip it
                        continue;
                    }

                    var hasUserAnswer = (component['_userAnswer'] !== undefined);
                    var isUserAnswerArray = (component['_userAnswer'] instanceof Array);


                    var numericParameters = [
                            blockLocation,
                            block['_trackingId'],
                            component['_score'] || 0,
                            component['_attemptsLeft'] || 0
                        ];

                    var booleanParameters = [
                            hasUserAnswer,
                            isUserAnswerArray,
                            component['_isInteractionComplete'],
                            component['_isSubmitted'],
                            component['_isCorrect'] || false
                        ];

                    var dataItem = [
                        numericParameters,
                        booleanParameters
                    ];


                    if (hasUserAnswer) {
                        var userAnswer = isUserAnswerArray ? component['_userAnswer'] : [component['_userAnswer']];

                        var arrayType = SCORMSuspendData.DataType.getArrayType(userAnswer);

                        switch(arrayType.name) {
                        case "string": case "variable":
                            console.log("Cannot store _userAnswers from component " + component._id + " as array is of variable or string type.");
                            continue;
                        }

                        dataItem.push(userAnswer);
                    }

                    data.push(dataItem);

                }

            }

            return data;

        },

        deserialize: function (str) {

            try {
                var data = SCORMSuspendData.deserialize(str);
                this.releaseData( data );
            } catch(e) {
                console.error(e);
            }
            
        },    

        releaseData: function (arr) {
            
            for (var i = 0, l = arr.length; i < l; i++) {
                var dataItem = arr[i];

                var numericParameters = dataItem[0];
                var booleanParameters = dataItem[1];

                var blockLocation = numericParameters[0];
                var trackingId = numericParameters[1];
                var score = numericParameters[2];
                var attemptsLeft = numericParameters[3] || 0;

                var hasUserAnswer = booleanParameters[0];
                var isUserAnswerArray = booleanParameters[1];
                var isInteractionComplete = booleanParameters[2];
                var isSubmitted = booleanParameters[3];
                var isCorrect = booleanParameters[4];

                var block = Adapt.blocks.findWhere({_trackingId: trackingId});
                var components = block.getChildren();
                components = components.where(includes);
                var component = components[blockLocation];

                component.set("_isComplete", true);
                component.set("_isInteractionComplete", isInteractionComplete);
                component.set("_isSubmitted", isSubmitted);
                component.set("_score", score);
                component.set("_isCorrect", isCorrect);
                component.set("_attemptsLeft", attemptsLeft);

                if (hasUserAnswer) {
                    var userAnswer = dataItem[2];
                    if (!isUserAnswerArray) userAnswer = userAnswer[0];

                    component.set("_userAnswer", userAnswer);
                }


            }
        }
    };

    return serializer;
});

define('extensions/adapt-contrib-spoor/js/adapt-stateful-session',[
	'core/js/adapt',
	'./serializers/default',
	'./serializers/questions'
], function(Adapt, serializer, questions) {

	//Implements Adapt session statefulness
	
	var AdaptStatefulSession = _.extend({

		_config: null,
		_shouldStoreResponses: false,
		_shouldRecordInteractions: true,

	//Session Begin
		initialize: function() {
			this._onWindowUnload = _.bind(this.onWindowUnload, this);
			this.getConfig();
			this.restoreSessionState();
			/*
			deferring this prevents restoring the completion state of the blocks from triggering a setSuspendData call for each block that gets its completion state restored
			we should be able to remove this if/when we implement the feature that allows plugins like spoor to pause course initialisation
			*/
			_.defer(_.bind(this.setupEventListeners, this));
		},

		getConfig: function() {
			this._config = Adapt.config.has('_spoor') ? Adapt.config.get('_spoor') : false;
			
			this._shouldStoreResponses = (this._config && this._config._tracking && this._config._tracking._shouldStoreResponses);
			
			// default should be to record interactions, so only avoid doing that if _shouldRecordInteractions is set to false
			if (this._config && this._config._tracking && this._config._tracking._shouldRecordInteractions === false) {
				this._shouldRecordInteractions = false;
			}
		},

		saveSessionState: function() {
			var sessionPairs = this.getSessionState();
			Adapt.offlineStorage.set(sessionPairs);
		},

		restoreSessionState: function() {
			var sessionPairs = Adapt.offlineStorage.get();
			var hasNoPairs = _.keys(sessionPairs).length === 0;

			if (hasNoPairs) return;

			if (sessionPairs.completion) serializer.deserialize(sessionPairs.completion);
			if (sessionPairs.questions && this._shouldStoreResponses) questions.deserialize(sessionPairs.questions);
			if (sessionPairs._isCourseComplete) Adapt.course.set('_isComplete', sessionPairs._isCourseComplete);
			if (sessionPairs._isAssessmentPassed) Adapt.course.set('_isAssessmentPassed', sessionPairs._isAssessmentPassed);
		},

		getSessionState: function() {
			var sessionPairs = {
				"completion": serializer.serialize(),
				"questions": (this._shouldStoreResponses === true ? questions.serialize() : ""),
				"_isCourseComplete": Adapt.course.get("_isComplete") || false,
				"_isAssessmentPassed": Adapt.course.get('_isAssessmentPassed') || false
			};
			return sessionPairs;
		},

	//Session In Progress
		setupEventListeners: function() {
			$(window).on('beforeunload unload', this._onWindowUnload);

			if (this._shouldStoreResponses) {
				this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onQuestionComponentComplete);
			}

			if(this._shouldRecordInteractions) {
				this.listenTo(Adapt, 'questionView:recordInteraction', this.onQuestionRecordInteraction);
			}

			this.listenTo(Adapt.blocks, 'change:_isComplete', this.onBlockComplete);
			this.listenTo(Adapt.course, 'change:_isComplete', this.onCompletion);
			this.listenTo(Adapt, 'assessment:complete', this.onAssessmentComplete);
			this.listenTo(Adapt, 'app:languageChanged', this.onLanguageChanged);
		},

		removeEventListeners: function () {
			$(window).off('beforeunload unload', this._onWindowUnload);
			this.stopListening();
		},

		reattachEventListeners: function() {
			this.removeEventListeners();
			this.setupEventListeners();
		},

		onBlockComplete: function(block) {
			this.saveSessionState();
		},

		onQuestionComponentComplete: function(component) {
			if (!component.get("_isQuestionType")) return;

			this.saveSessionState();
		},

		onCompletion: function() {
			if (!this.checkTrackingCriteriaMet()) return;

			this.saveSessionState();
			
			Adapt.offlineStorage.set("status", this._config._reporting._onTrackingCriteriaMet);
		},

		onAssessmentComplete: function(stateModel) {
			Adapt.course.set('_isAssessmentPassed', stateModel.isPass);
			
			this.saveSessionState();

			this.submitScore(stateModel);

			if (stateModel.isPass) {
				this.onCompletion();
			} else if (this._config && this._config._tracking._requireAssessmentPassed) {
				this.submitAssessmentFailed();
			}
		},

		onQuestionRecordInteraction:function(questionView) {
			var responseType = questionView.getResponseType();

			// if responseType doesn't contain any data, assume that the question component hasn't been set up for cmi.interaction tracking
			if(_.isEmpty(responseType)) return;

			var id = questionView.model.get('_id');
			var response = questionView.getResponse();
			var result = questionView.isCorrect();
			var latency = questionView.getLatency();
			
			Adapt.offlineStorage.set("interaction", id, response, result, latency, responseType);
		},

		/**
		 * when the user switches language, we need to:
		 * - reattach the event listeners as the language change triggers a reload of the json, which will create brand new collections
		 * - get and save a fresh copy of the session state. as the json has been reloaded, the blocks completion data will be reset (the user is warned that this will happen by the language picker extension)
		 * - check to see if the config requires that the lesson_status be reset to 'incomplete'
		 */
		onLanguageChanged: function () {
			this.reattachEventListeners();

			this.saveSessionState();
			
			if (this._config._reporting && this._config._reporting._resetStatusOnLanguageChange === true) {
				Adapt.offlineStorage.set("status", "incomplete");
			}
		},

		submitScore: function(stateModel) {
			if (this._config && !this._config._tracking._shouldSubmitScore) return;

			if (stateModel.isPercentageBased) {
				Adapt.offlineStorage.set("score", stateModel.scoreAsPercent, 0, 100);
			} else {
				Adapt.offlineStorage.set("score", stateModel.score, 0, stateModel.maxScore);
			}
		},

		submitAssessmentFailed: function() {
			if (this._config && this._config._reporting.hasOwnProperty("_onAssessmentFailure")) {
				var onAssessmentFailure = this._config._reporting._onAssessmentFailure;
				if (onAssessmentFailure === "") return;
					
				Adapt.offlineStorage.set("status", onAssessmentFailure);
			}
		},
		
		checkTrackingCriteriaMet: function() {
			var criteriaMet = false;

			if (!this._config) {
				return false;
			}

			if (this._config._tracking._requireCourseCompleted && this._config._tracking._requireAssessmentPassed) { // user must complete all blocks AND pass the assessment
				criteriaMet = (Adapt.course.get('_isComplete') && Adapt.course.get('_isAssessmentPassed'));
			} else if (this._config._tracking._requireCourseCompleted) { //user only needs to complete all blocks
				criteriaMet = Adapt.course.get('_isComplete');
			} else if (this._config._tracking._requireAssessmentPassed) { // user only needs to pass the assessment
				criteriaMet = Adapt.course.get('_isAssessmentPassed');
			}

			return criteriaMet;
		},

	//Session End
		onWindowUnload: function() {
			this.removeEventListeners();
		}
		
	}, Backbone.Events);

	return AdaptStatefulSession;

});
define('extensions/adapt-contrib-spoor/js/adapt-offlineStorage-scorm',[
	'core/js/adapt',
	'./scorm',
	'core/js/offlineStorage'
], function(Adapt, scorm) {

	//SCORM handler for Adapt.offlineStorage interface.

	//Stores to help handle posting and offline uniformity
	var temporaryStore = {};
	var suspendDataStore = {};
	var suspendDataRestored = false;

	Adapt.offlineStorage.initialize({

		get: function(name) {
			if (name === undefined) {
				//If not connected return just temporary store.
				if (this.useTemporaryStore()) return temporaryStore;

				//Get all values as a combined object
				suspendDataStore = this.getCustomStates();

				var data = _.extend(_.clone(suspendDataStore), {
					location: scorm.getLessonLocation(),
					score: scorm.getScore(),
					status: scorm.getStatus(),
					student: scorm.getStudentName(),
					learnerInfo: this.getLearnerInfo()
				});

				suspendDataRestored = true;
				
				return data;
			}

			//If not connected return just temporary store value.
			if (this.useTemporaryStore()) return temporaryStore[name];

			//Get by name
			switch (name.toLowerCase()) {
				case "location":
					return scorm.getLessonLocation();
				case "score":
					return scorm.getScore();
				case "status":
					return scorm.getStatus();
				case "student":// for backwards-compatibility. learnerInfo is preferred now and will give you more information
					return scorm.getStudentName();
				case "learnerinfo":
					return this.getLearnerInfo();
				default:
					return this.getCustomState(name);
			}
		},

		set: function(name, value) {
			//Convert arguments to array and drop the 'name' parameter
			var args = [].slice.call(arguments, 1);
			var isObject = typeof name == "object";

			if (isObject) {
				value = name;
				name = "suspendData";
			}

			if (this.useTemporaryStore()) {
				if (isObject) {
					temporaryStore = _.extend(temporaryStore, value);
				} else {
					temporaryStore[name] = value;
				}

				return true;
			}

			switch (name.toLowerCase()) {
				case "interaction":
					return scorm.recordInteraction.apply(scorm, args);
				case "location":
					return scorm.setLessonLocation.apply(scorm, args);
				case "score":
					return scorm.setScore.apply(scorm, args);
				case "status":
					return scorm.setStatus.apply(scorm, args);
				case "student":
				case "learnerinfo":
					return false;// these properties are read-only
				case "suspenddata":
				default:
					if (isObject) {
						suspendDataStore = _.extend(suspendDataStore, value);
					} else {
						suspendDataStore[name] = value;
					}

					var dataAsString = JSON.stringify(suspendDataStore);
					return (suspendDataRestored) ? scorm.setSuspendData(dataAsString) : false;
			}
		},

		getCustomStates: function() {
			var isSuspendDataStoreEmpty = _.isEmpty(suspendDataStore);
			if (!isSuspendDataStoreEmpty && suspendDataRestored) return _.clone(suspendDataStore);

			var dataAsString = scorm.getSuspendData();
			if (dataAsString === "" || dataAsString === " " || dataAsString === undefined) return {};

			var dataAsJSON = JSON.parse(dataAsString);
			if (!isSuspendDataStoreEmpty && !suspendDataRestored) dataAsJSON = _.extend(dataAsJSON, suspendDataStore);
			return dataAsJSON;
		},

		getCustomState: function(name) {
			var dataAsJSON = this.getCustomStates();
			return dataAsJSON[name];
		},
		
		useTemporaryStore: function() {
			var cfg = Adapt.config.get('_spoor');
			
			if (!scorm.lmsConnected || (cfg && cfg._isEnabled === false)) return true;
			return false;
		},

		/**
		 * Returns an object with the properties:
		 * - id (cmi.core.student_id)
		 * - name (cmi.core.student_name - which is usually in the format "Lastname, Firstname" - but sometimes doesn't have the space after the comma)
		 * - firstname
		 * - lastname
		 */
		getLearnerInfo: function() {
			var name = scorm.getStudentName();
			var firstname = "", lastname = "";
			if (name && name !== 'undefined' && name.indexOf(",") > -1) {
				//last name first, comma separated
				var nameSplit = name.split(",");
				lastname = $.trim(nameSplit[0]);
				firstname = $.trim(nameSplit[1]);
				name = firstname + " " + lastname;
			} else {
				console.log("SPOOR: LMS learner_name not in 'lastname, firstname' format");
			}
			return {
				name: name,
				lastname: lastname,
				firstname: firstname,
				id: scorm.getStudentId()
			};
		}
		
	});

});
define('extensions/adapt-contrib-spoor/js/adapt-contrib-spoor',[
    'core/js/adapt',
    './scorm',
    './adapt-stateful-session',
    './adapt-offlineStorage-scorm'
], function(Adapt, scorm, adaptStatefulSession) {

    //SCORM session manager

    var Spoor = _.extend({

        _config: null,

    //Session Begin

        initialize: function() {
            this.listenToOnce(Adapt, "configModel:dataLoaded", this.onConfigLoaded);
            this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
        },

        onConfigLoaded: function() {
            if (!this.checkConfig()) {
                if (Adapt.offlineStorage.setReadyStatus) {// backwards-compatibility check - setReadyStatus was only introduced in framework v2.0.14
                    Adapt.offlineStorage.setReadyStatus();
                }
                return;
            }

            this.configureAdvancedSettings();

            scorm.initialize();

            /*
            force offlineStorage-scorm to initialise suspendDataStore - this allows us to do things like store the user's 
            chosen language before the rest of the course data loads 
            */
            Adapt.offlineStorage.get();

            if (Adapt.offlineStorage.setReadyStatus) {
                Adapt.offlineStorage.setReadyStatus();
            }

            this.setupEventListeners();
        },

        onDataReady: function() {
            adaptStatefulSession.initialize();
        },

        checkConfig: function() {
            this._config = Adapt.config.get('_spoor') || false;

            if (this._config && this._config._isEnabled !== false) return true;
            
            return false;
        },

        configureAdvancedSettings: function() {
            if(this._config._advancedSettings) {
                var settings = this._config._advancedSettings;

                if(settings._showDebugWindow) scorm.showDebugWindow();

                scorm.setVersion(settings._scormVersion || "1.2");

                if(settings.hasOwnProperty("_suppressErrors")) {
                    scorm.suppressErrors = settings._suppressErrors;
                }

                if(settings.hasOwnProperty("_commitOnStatusChange")) {
                    scorm.commitOnStatusChange = settings._commitOnStatusChange;
                }

                if(settings.hasOwnProperty("_timedCommitFrequency")) {
                    scorm.timedCommitFrequency = settings._timedCommitFrequency;
                }

                if(settings.hasOwnProperty("_maxCommitRetries")) {
                    scorm.maxCommitRetries = settings._maxCommitRetries;
                }

                if(settings.hasOwnProperty("_commitRetryDelay")) {
                    scorm.commitRetryDelay = settings._commitRetryDelay;
                }
            } else {
                /**
                * force use of SCORM 1.2 by default - some LMSes (SABA/Kallidus for instance) present both APIs to the SCO and, if given the choice,
                * the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
                */
                scorm.setVersion("1.2");
            }

            /**
            * suppress SCORM errors if 'nolmserrors' is found in the querystring
            */
            if(window.location.search.indexOf('nolmserrors') != -1) scorm.suppressErrors = true;
        },

        setupEventListeners: function() {
            var advancedSettings = this._config._advancedSettings;
            var shouldCommitOnVisibilityChange = (!advancedSettings ||
                advancedSettings._commitOnVisibilityChangeHidden !== false) &&
                document.addEventListener;

            this._onWindowUnload = _.bind(this.onWindowUnload, this);
            $(window).on('beforeunload unload', this._onWindowUnload);

            if (shouldCommitOnVisibilityChange) {
                document.addEventListener("visibilitychange", this.onVisibilityChange);
            }

            require(['libraries/jquery.keycombo'], function() {
                // listen for user holding 'd', 'e', 'v' keys together
                $.onKeyCombo([68, 69, 86], function() {
                    scorm.showDebugWindow();
                });
            });
        },

        onVisibilityChange: function() {
            if (document.visibilityState === "hidden") scorm.commit();
        },

    //Session End

        onWindowUnload: function() {
            $(window).off('beforeunload unload', this._onWindowUnload);

            scorm.finish();
        }
        
    }, Backbone.Events);

    Spoor.initialize();

});

define('extensions/adapt-contrib-trickle/js/trickleView',[
    'coreJS/adapt'
], function(Adapt) {

    var TrickleView = Backbone.View.extend({

        isSteplocked: false,

        initialize: function(options) {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            var AdaptEvents = {
                "trickle:kill": this.onKill,
                "remove": this.onRemove
            };
            
            this.onPreRender(this);

            AdaptEvents[this.model.get("_type") + "View:postRender"] = this.onPostRender;
            this.listenTo(Adapt, AdaptEvents);

            this.on("steplock", this.onStepLock);
            this.on("stepunlock", this.onStepUnlock);
        },

        onPreRender: function(view) {
            if (!this.isElementEnabled()) return;

            Adapt.trigger("trickle:preRender", this);
        },

        onPostRender: function(view) {
            if (view.model.get("_id") !== this.model.get("_id")) return;
            if (!this.isElementEnabled()) return;

            Adapt.trigger("trickle:postRender", this);
        },

        isElementEnabled: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            if (!trickle) return false;

            var isArticleWithOnChildren = (this.model.get("_type") === "article" && trickle._onChildren);
            if (isArticleWithOnChildren) {
                return false;
            }

            if (trickle._isEnabled === true) return true;
            return false;
        },

        onStepLock: function() {
            if (!this.isElementEnabled()) {
                this.continueToNext();
                return;
            }

            var trickle = Adapt.trickle.getModelConfig(this.model);
            var isSteplocking = (trickle._stepLocking && trickle._stepLocking._isEnabled);
            if (!isSteplocking) {
                this.continueToNext();
                return;
            }

            Adapt.trigger("trickle:steplock", this);
            //console.log("trickle steplock at", this.model.get("_id"))

            this.isSteplocked = true;
        },

        continueToNext: function() {
            _.defer(_.bind(function() {
                Adapt.trigger("trickle:continue", this);
            }, this));
        },


        onStepUnlock: function() {
            if (!this.isSteplocked) return;
            this.isSteplocked = false;
            Adapt.trigger("trickle:stepunlock", this);
        },

        onKill: function() {
            this.detachFromElement()
        },

        onRemove: function() {
            this.detachFromElement();
        },

        detachFromElement: function() {
            this.undelegateEvents();
            this.stopListening();
            this.model = null;
            this.articleModel = null;
            this.$el = null;
            this.el = null;
        }
                
    });

    return TrickleView;

})
;
define('extensions/adapt-contrib-trickle/js/pageView',[
    'coreJS/adapt',
    './trickleView'
], function(Adapt, TrickleView) {

    var PageView = Backbone.View.extend({

        currentDescendantIndex: 0,
        currentLocksOnDescendant: 0,
        currentDescendant: null,

        initialize: function(options) {
            if (!this.isPageEnabled()) {
                return this.detachFromPage();
            }
            this.setupDescendants();
            if (!this.haveDescendantsGotTrickle()) {
                return this.detachFromPage();   
            }
            this.addClassToHtml();
            this.setupEventListeners();
        },

        isPageEnabled: function() {
            var trickleConfig = Adapt.trickle.getModelConfig(this.model);
            if (trickleConfig && trickleConfig._isEnabled === false) return false;
            return true;
        },

        setupDescendants: function() {
            this.currentDescendant = null;
            this.descendantViews = {};
            this.getDescendants();
            Adapt.trigger("trickle:descendants", this);
        },

        descendantsChildFirst: null,
        descendantsParentFirst: null,
        descendantViews: null,

        getDescendants: function() {
            this.descendantsChildFirst = this.model.getDescendants();
            this.descendantsParentFirst = this.model.getDescendants(true);

            //if some descendants flip between _isAvailable true/false they must have their defaults set before the filter is applied
            this.setDescendantsTrickleDefaults();

            this.descendantsChildFirst = this.filterComponents(this.descendantsChildFirst);
            this.descendantsParentFirst = this.filterComponents(this.descendantsParentFirst);

        },

        filterComponents: function(descendants) {
            return new Backbone.Collection(descendants.filter(function(descendant) {
                if (descendant.get("_type") === "component") return false;
                if (!descendant.get("_isAvailable")) return false;
                return true;
            }));
        },

        setDescendantsTrickleDefaults: function() {
            //use parent first as likely to get to article 
            //
            this.descendantsParentFirst.each(_.bind(function(descendant) {

                var trickle = Adapt.trickle.getModelConfig(descendant);
                var noTrickleConfig = (!trickle);

                //check if descendant has trickle settings
                if (noTrickleConfig) return;

                //check if trickle is configures on descendant
                //NOTE: Removed for banked assessments
                //var isTrickleConfigured = descendant.get("_isTrickleConfigured");
                //if (isTrickleConfigured) return;

                //setup steplocking defaults
                trickle._stepLocking = _.extend({
                    "_isEnabled": true, //(default=true)
                    "_isCompletionRequired": true, //(default=true)
                    "_isLockedOnRevisit": false //(default=false)
                }, trickle._stepLocking);

                //setup main trickle defaults
                trickle = _.extend({
                    "_isEnabled": true, //(default=true)
                    "_autoScroll": true, //(default=true)
                    "_scrollDuration": 500, //(default=500)
                    "_onChildren": true, //(default=true)
                    "_scrollTo": "@block +1", //(default="@block +1")
                }, trickle);

                Adapt.trickle.setModelConfig(descendant, trickle);

                //check article "onChildren" rule
                if (trickle._onChildren 
                    && descendant.get("_type") === "article") {
                    this.setupArticleOnChildren(descendant, trickle);
                }

                //set descendant trickle as configured
                descendant.set("_isTrickleConfigured", true);

            }, this));
        },

        setupArticleOnChildren: function(articleModel, articleTrickleConfig) {
            //set trickle on all blocks, using article config with block overrides
            var articleBlocks = articleModel.getChildren();

            articleBlocks.each(function(blockModel, index) {
                var blockTrickleConfig = Adapt.trickle.getModelConfig(blockModel);

                //overlay block trickle on article trickle
                //this allows values to carry through from the article to the block 
                //retains any value overriden in the block
                for (var k in blockTrickleConfig) {
                    //handle nested objects to one level
                    if (typeof blockTrickleConfig[k] === "object") {
                        blockTrickleConfig[k] = _.extend({}, articleTrickleConfig[k], blockTrickleConfig[k]);
                    }
                }

                blockTrickleConfig = _.extend({}, articleTrickleConfig, blockTrickleConfig);


                //setup start/final config
                if (articleBlocks.length === index+1) {
                    blockTrickleConfig._isFinal = true;
                }
                if (index === 0) {
                    blockTrickleConfig._isStart = true;
                }

                Adapt.trickle.setModelConfig(blockModel, blockTrickleConfig);
            });

        },

        haveDescendantsGotTrickle: function() {
            return this.descendantsChildFirst.some(function(descendant) {
                var trickle = Adapt.trickle.getModelConfig(descendant);
                if (!trickle) return false;
                if (trickle._isEnabled === true) {
                    return true;
                }
                return false;
            });
        },

        addClassToHtml: function() {
            $("html").addClass("trickle");
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "remove": this.onRemove,
                
                "articleView:preRender": this.onDescendantPreRender,
                "blockView:preRender": this.onDescendantPreRender,

                "trickle:unwait": this.onUnwait,
                "trickle:wait": this.onWait,
                "trickle:continue": this.onContinue,
                "trickle:skip": this.onSkip,

                "trickle:kill": this.onKill
            });
            this.listenToOnce(this.model, "change:_isReady", this.onPageReady)
        },

        onDescendantPreRender: function(view) {
            //ignore components
            if (view.model.get("_type") === "component") return;

            var descendantView = new TrickleView({
                model: view.model,
                el: view.el
            });
            this.descendantViews[view.model.get("_id")] = descendantView;
        },

        //trickle lifecycle

        onPageReady: function(model, value) {
            if (!value) return;

            this.currentDescendant = null;

            Adapt.trigger("trickle:started");
            this.gotoNextDescendant();
        },

        gotoNextDescendant: function() {
            this.getDescendants();

            if (this.currentDescendant) {
                this.currentDescendant.trigger("stepunlock");
                this.currentDescendant = null;
            }

            for (var index = this.currentDescendantIndex || 0, l = this.descendantsChildFirst.models.length; index < l; index++) {
                var descendant = this.descendantsChildFirst.models[index];
                switch ( descendant.get("_type") ) {
                case "block": case "article":
                    this.currentLocksOnDescendant = 0;
                    this.currentDescendantIndex = index;
                    var currentId = descendant.get("_id");
                    this.currentDescendant = this.descendantViews[currentId];
                    this.currentDescendant.trigger("steplock");
                    return;
                }
            }
            this.finished();
        },

        onContinue: function(view) {
            if (!this.currentDescendant) return;
            if (view.model.get("_id") !== this.currentDescendant.model.get("_id")) return;

            this.onSkip();
        },

        onWait: function() {
            this.currentLocksOnDescendant++;
        },

        onUnwait: function() {
            this.currentLocksOnDescendant--;
            if (this.currentLocksOnDescendant > 0) return;
            
            var lastDescendant = this.currentDescendant.model;
            
            this.currentDescendantIndex++;
            this.gotoNextDescendant();

            Adapt.trickle.scroll(lastDescendant);
            
        },

        onSkip: function() {
            //wait for all handlers to accept skip
            _.defer(_.bind(function() {
                this.currentDescendantIndex++;
                this.gotoNextDescendant();
            }, this));
        },

        onKill: function() {
            this.finished();
            this.detachFromPage();
        },

        finished: function() {
            Adapt.trigger("trickle:finished");
            this.detachFromPage();
        },

        //end of trickle lifecycle

        onRemove: function() {
            this.finished();
        },

        detachFromPage: function() {
            this.removeClassFromHtml();
            this.undelegateEvents();
            this.stopListening();
            this.model = null;
            this.$el = null;
            this.el = null;
            this.currentDescendant = null;
            this.descendantViews = null;
            this.descendantsChildFirst = null;
            this.descendantsParentFirst = null;
            Adapt.trickle.pageView = null;
        },

        removeClassFromHtml: function() {
            $("html").removeClass("trickle");
        }
                
    });

    return PageView;

})
;
define('extensions/adapt-contrib-trickle/js/lib/adaptModelExtension',[
    'coreJS/adapt',
    'coreModels/adaptModel'
], function(Adapt, AdaptModel) {

    _.extend(AdaptModel.prototype, {
        
        /*
        * Fetchs the sub structure of an id as a flattened array
        *
        *   Such that the tree:
        *       { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
        *
        *   will become the array (parent first = false):
        *       [ c1, c2, b1, c3, c4, b2, a1, c5, c6, b3, a2 ]
        *
        *   or (parent first = true):
        *       [ a1, b1, c1, c2, b2, c3, c4, a2, b3, c5, c6 ]
        *
        * This is useful when sequential operations are performed on the page/article/block/component hierarchy.
        */
        getDescendants: function(parentFirst) {
            var descendants = [];

            if (this.get("_type") === "component") {
                descendants.push(this);
                return new Backbone.Collection(descendants);
            }

            var children = this.getChildren();

            for (var i = 0, l = children.models.length; i < l; i++) {

                var child = children.models[i];
                if (child.get("_type") === "component") {

                    descendants.push(child);

                } else {

                    var subDescendants = child.getDescendants(parentFirst);
                    if (parentFirst == true) descendants.push(child);
                    descendants = descendants.concat(subDescendants.models);
                    if (parentFirst != true) descendants.push(child);

                }

            }

            return new Backbone.Collection(descendants);
        },

        /*
        * Returns a relative structural item from the Adapt hierarchy
        *   
        *   Such that in the tree:
        *       { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
        *
        *       findRelative(modelC1, "@block +1") = modelB2;
        *       findRelative(modelC1, "@component +4") = modelC5;
        *
        */
        findRelative: function(relativeString, options) {
            var types = [ "menu", "page", "article", "block", "component" ];

            options = options || {};

            var modelId = this.get("_id");
            var modelType = this.get("_type");

            //return a model relative to the specified one if opinionated
            var rootModel = Adapt.course;
            if (options.limitParentId) {
                rootModel = Adapt.findById(options.limitParentId);
            }

            var relativeDescriptor = parseRelativeString(relativeString);

            var findAncestorType = (_.indexOf(types, modelType) > _.indexOf(types, relativeDescriptor.type));
            var findSameType = (modelType === relativeDescriptor.type);

            var searchBackwards = false;
            var movementCount = 0;

            // children first [c,c,b,a,c,c,b,a,p,c,c,b,a,c,c,b,a,p]
            var pageDescendants = rootModel.getDescendants().toJSON();

            //choose search style
            if (findSameType || findAncestorType) {
                //examples a<>a or c<>b,a,p
                //assume next is 0 index
                //assume last is -1 index
                searchBackwards = (relativeDescriptor.offset <= 0);
            } else {
                //finding descendant
                //examples a<>c or a<>b
                if (relativeDescriptor.offset < 1) {
                    //assume last descendant is 0 index
                    searchBackwards = true;
                } else {
                    //assume next descendant is +1 index
                    movementCount = 1;
                    searchBackwards = false;
                }
            }

            //exclude not available and not visible if opinionated
            if (options.filterNotVisible) {
                pageDescendants = _.filter(pageDescendants, function(descendant) {
                    return descendant._isVisible;
                });
            } 
            if (options.filterNotAvailable) {
                pageDescendants = _.filter(pageDescendants, function(descendant) {
                    return descendant._isAvailable;
                });
            } 

            //find current index in array
            var modelIndex = _.findIndex(pageDescendants, function(pageDescendant) {
                if (pageDescendant._id === modelId) {
                    return true;
                }
                return false;
            });

            //search in appropriate order
            if (searchBackwards) {
                for (var i = modelIndex, l = -1; i > l; i--) {
                    var descendant = pageDescendants[i];
                    if (descendant._type === relativeDescriptor.type) {
                        if (-movementCount === relativeDescriptor.offset) {
                            return Adapt.findById(descendant._id);
                        }
                        movementCount++;
                    }
                }
            } else {
                for (var i = modelIndex, l = pageDescendants.length; i < l; i++) {
                    var descendant = pageDescendants[i];
                    if (descendant._type === relativeDescriptor.type) {
                        if (movementCount === relativeDescriptor.offset) {
                            return Adapt.findById(descendant._id);
                        }
                        movementCount++;
                    }
                }
            }

            return undefined;
        }
    });


    function parseRelativeString(relativeString) {
        var type = relativeString.substr(0, _.indexOf(relativeString, " "));
        var offset = parseInt(relativeString.substr(type.length));
        type = type.substr(1);

        /*RETURN THE TYPE AND OFFSET OF THE SCROLLTO
        * "@component +1"  : 
        * {
        *       type: "component",
        *       offset: 1
        * }
        */
        return { 
            type: type,
            offset: offset
        };
    }

});

define('extensions/adapt-contrib-trickle/js/handlers/buttonView',[
    'coreJS/adapt',
    'coreViews/componentView'
], function(Adapt, ComponentView) {

    var completionAttribute = "_isInteractionComplete";

    var TrickleButtonView = Backbone.View.extend({

        isStepLocking: false,
        hasStepLocked: false,
        isStepLocked: false,
        isStepLockFinished: false,
        hasStepPreCompleted: false,
        isWaitingForClick: false,
        allowVisible: false,
        allowEnabled: true,
        overlayShownCount: 0,

        el: function() {

            this.setupPreRender();

            return Handlebars.templates['trickle-button'](this.model.toJSON());
        },

        setupPreRender: function() {
            
            this.setupButtonVisible();
            this.setupButtonEnabled();
        },

        setupButtonVisible: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            this.allowVisible = false;
            trickle._button._isVisible = false;

            if (trickle._button._styleBeforeCompletion === "visible") {
                this.allowVisible = true;
                if (trickle._button._autoHide && trickle._button._isFullWidth) {
                    trickle._button._isVisible = false;    
                } else {
                    trickle._button._isVisible = true;
                }
            }
        },

        setupButtonEnabled: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            
            if (trickle._stepLocking._isCompletionRequired === false) {
                this.allowEnabled = true;
                trickle._button._isDisabled = false;   
            } else if (trickle._button._styleBeforeCompletion === "visible") {
                this.allowEnabled = false;
                trickle._button._isDisabled = true;
            } else {
                trickle._button._isDisabled = false;
                this.allowEnabled = true;
            }

        },
        
        events: {
            "click button": "onButtonClick"
        },

        initialize: function(options) {
            this.getCompletionAttribute();
            this.debounceCheckAutoHide();
            this.setupStepLocking();
            this.setupEventListeners();
        },

        getCompletionAttribute: function() {
            var trickle = Adapt.trickle.getModelConfig(Adapt.config);
            if (!trickle) return;
            if (trickle._completionAttribute) {
                completionAttribute = trickle._completionAttribute
            }
        },

        setupStepLocking: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            if (trickle._stepLocking._isEnabled) {
                this.isStepLocked = true;
            } else {
                this.isStepLocked = false;
            }
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:overlay": this.onOverlay,
                "trickle:unoverlay": this.onUnoverlay,
                "trickle:steplock": this.onStepLock,
                "trickle:stepunlock": this.onStepUnlock,
                "trickle:skip": this.onSkip,
                "trickle:kill": this.onKill,
                "trickle:update": this.onUpdate,
                "remove": this.onRemove 
            });

            this.listenTo(this.model, "change:"+completionAttribute, this.onCompletion);
        },

        debounceCheckAutoHide: function() {
            this.checkButtonAutoHideSync = this.checkButtonAutoHide;
            this.checkButtonAutoHide = _.debounce(_.bind(this.checkButtonAutoHide, this), 100);
        },

        checkButtonAutoHide: function() {
            if (!this.allowVisible) {
                this.setButtonVisible(false);
                return;
            }

            var trickle = Adapt.trickle.getModelConfig(this.model);
            if (!trickle._button._autoHide) {
                this.setButtonVisible(true);
                return;
            } else if (this.overlayShownCount > 0) {
                this.setButtonVisible(false);
                return;
            }

            var measurements = this.$el.onscreen();

            //this is to fix ios7 iphone4 miscalculation
            var isJustOffscreen = (measurements.bottom > -100);


            //add show/hide animation here if needed
            if (measurements.onscreen || isJustOffscreen) {
                this.setButtonVisible(true);
            } else {
                this.setButtonVisible(false);
            }
        },

        setButtonVisible: function(bool) {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            if (!bool) {
                this.$(".component-inner").addClass("display-none");
                trickle._button._isVisible = false;
                //console.log("trickle hiding button", this.model.get("_id"));
            } else {
                this.$(".component-inner").removeClass("display-none");
                trickle._button._isVisible = true;
                //console.log("trickle showing button", this.model.get("_id"));
            }
        },

        checkButtonEnabled: function(bool) {
            if (!this.allowEnabled) {
                this.setButtonEnabled(false);
            } else {
                this.setButtonEnabled(true);
            }
        },

        setButtonEnabled: function(bool) {
            var trickle = Adapt.trickle.getModelConfig(this.model);
            if (bool) {
                this.$("button").removeClass("disabled").removeAttr("disabled");
                trickle._button._isDisabled = true;
            } else {
                this.$("button").addClass("disabled").attr("disabled", "disabled");
                trickle._button._isDisabled = false;
            }
        },

        onStepLock: function(view) {
            if (!this.isViewMatch(view)) return;

            this.hasStepLocked = true;
            this.isStepLocking = true;
            this.overlayShownCount = 0;

            var trickle = Adapt.trickle.getModelConfig(this.model);

            if (this.isButtonEnabled()) {
                var isCompleteAndShouldRelock = (trickle._stepLocking._isLockedOnRevisit && this.model.get(completionAttribute));

                if (isCompleteAndShouldRelock) {
                    this.isStepLocked = true;
                    this.model.set("_isTrickleAutoScrollComplete", false);
                    Adapt.trigger("trickle:wait");
                    this.allowVisible = true;
                    this.checkButtonAutoHide();
                } else if (this.hasStepPreCompleted) {
                    //force the button to show if section completed before it was steplocked
                    this.isStepLocked = true;
                    this.model.set("_isTrickleAutoScrollComplete", false);
                    this.allowVisible = true;
                    this.stepCompleted();
                }
                this.setupOnScreenListener();
            }
        },

        onOverlay: function() {
            this.overlayShownCount++;
        },

        onUnoverlay: function() {
            this.overlayShownCount--;
            this.checkButtonAutoHide();
        },

        setupOnScreenListener: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);

            if (trickle._button._autoHide) {
                this.$el.on("onscreen", this.checkButtonAutoHide);
            }
        },

        isViewMatch: function(view) {
            return view.model.get("_id") === this.model.get("_id");
        },

        isButtonEnabled: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);

            if (!trickle._isEnabled || !trickle._button._isEnabled) return false;
            return true;
        },

        onCompletion: function(model, value) {
            if (value === false) return;

            this.hasStepPreCompleted = true;

            if (!this.hasStepLocked) return;

            _.defer(_.bind(function() {
                this.stepCompleted();
            }, this));
        },

        stepCompleted: function() {

            if (this.isStepLockFinished) return;

            this.isStepLocked = false;
            this.allowVisible = false;
            this.allowEnabled = false;

            if (this.isButtonEnabled()) {
                if (this.isStepLocking) {

                    this.isStepLocked = true;
                    this.isWaitingForClick = true;
                    Adapt.trigger("trickle:wait");

                } else {

                    this.isStepLockFinished = true;
                }

                this.allowVisible = true;
                this.allowEnabled = true;
            }

            this.model.set("_isTrickleAutoScrollComplete", false);
            this.checkButtonAutoHide();
            this.checkButtonEnabled();

        },

        onButtonClick: function() {
            if (this.isStepLocked) {
                Adapt.trigger("trickle:unwait");
                this.isStepLocked = false;
                this.isStepLockFinished = true;

            } else {
                this.model.set("_isTrickleAutoScrollComplete", false);
                _.defer(_.bind(function() {
                    Adapt.trickle.scroll(this.model);
                }, this));
            }

            var trickle = this.model.get("_trickle");
            switch (trickle._button._styleAfterClick) {
            case "hidden":
                this.allowVisible = false;
                this.checkButtonAutoHideSync();
                break;
            case "disabled":
                this.allowEnabled = false;
                this.checkButtonAutoHideSync();
            }
        },

        onUpdate: function() {
            var trickle = Adapt.trickle.getModelConfig(this.model);

            if (trickle._button._autoHide && this.isStepLocking) {
                this.$el.off("onscreen", this.checkButtonAutoHide);
            }
            
            var $original = this.$el;
            var $newEl = $(Handlebars.templates['trickle-button'](this.model.toJSON()));
            $original.replaceWith($newEl);

            this.setElement($newEl);

            if (trickle._button._autoHide && this.isStepLocking) {
                this.$el.on("onscreen", this.checkButtonAutoHide);
            }
        },

        onStepUnlock: function(view) {
            if (!this.isViewMatch(view)) return;
            this.$el.off("onscreen", this.checkButtonAutoHide);
            this.isStepLocking = false;
            this.overlayShownCount = 0;
        },

        onSkip: function() {
            if (!this.isStepLocking) return;

            this.onKill();
        },

        onKill: function() {
            this.$el.off("onscreen", this.checkButtonAutoHide);
            if (this.isWaitingForClick) {
                this.model.set("_isTrickleAutoScrollComplete", true);
            }
            this.isWaitingForClick = false;
            this.isStepLocked = false;
            this.isStepLocking = false;
            this.allowVisible = false;
            this.allowEnabled = false;
            this.isStepLockFinished = true;
            this.model.set("_isTrickleAutoScrollComplete", false);
            this.checkButtonAutoHide();
            this.checkButtonEnabled();
        },

        onRemove: function() {
            if (this.isWaitingForClick) {
                this.model.set("_isTrickleAutoScrollComplete", true);
            }
            this.isWaitingForClick = false;
            this.$el.off("onscreen", this.checkButtonAutoHide);
            this.isStepLocking = true;
            this.remove();
        }

    });

    return TrickleButtonView;
});

define('extensions/adapt-contrib-trickle/js/handlers/button',[
    'coreJS/adapt',
    './buttonView'
], function(Adapt, ButtonView) {

    var TrickleButtonHandler = _.extend({

        buttonViews: null,

        initialize: function() {
            this.listenToOnce(Adapt, {
                "app:dataReady": this.onAppDataReady,
                "remove": this.onRemove
            });
        },

        onAppDataReady: function() {
            this.buttonViews = {};
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:preRender": this.onPreRender,
                "trickle:postRender": this.onPostRender,
            });
        },

        onPreRender: function(view) {
            //setup button on prerender to allow it to control the steplocking process
            if (!this.isTrickleEnabled(view.model)) return;

            this.setupConfigDefaults(view.model);

            this.buttonViews[view.model.get("_id")] = new ButtonView({
                model: view.model
            });
        },

        onPostRender: function(view) {
            //inject the button at post render
            if (!this.isTrickleEnabled(view.model)) return;

            view.$el.append(this.buttonViews[view.model.get("_id")].$el);
        },

        isTrickleEnabled: function(model) {
            var trickle = Adapt.trickle.getModelConfig(model);
            if (!trickle || !trickle._isEnabled) return false;

            if (trickle._onChildren && model.get("_type") === "article") return false;

            return true;
        },

        setupConfigDefaults: function(model) {
            if (model.get("_isTrickleButtonConfigured")) return;

            var trickle = Adapt.trickle.getModelConfig(model);
            trickle._button = _.extend({
                "_isEnabled": true, //(default=true)
                "_styleBeforeCompletion": "hidden", //(default=hidden)
                "_styleAfterClick": "hidden", //(default=hidden)
                "_isFullWidth": true, //(default=true)
                "_autoHide": true, //(default=true)
                "_className": "", //(default="")
                "text": "Continue", //(default="Continue")
                "startText": "Begin", //(default="Begin")
                "finalText": "Finish", //(default="Finish")
                "_component": "trickle-button", //(default="trickle-button")
                "_isLocking": true,
                "_isVisible": false,
                "_isDisabled": false
            }, trickle._button);


            if (trickle._button._isFullWidth) {
                trickle._stepLocking._isEnabled = true;
                trickle._button._styleAfterClick = "hidden";
            } else {
                trickle._button._autoHide = false;
            }

            Adapt.trickle.setModelConfig(model, trickle);
            model.set("_isTrickleButtonConfigured", true);

        },

        onRemove: function() {
            this.buttonViews = {};
        }

    }, Backbone.Events);

    TrickleButtonHandler.initialize();

    return TrickleButtonHandler;
});

define('extensions/adapt-contrib-trickle/js/handlers/completion',[
    'coreJS/adapt', 
], function(Adapt) {

    var completionAttribute = "_isInteractionComplete";

    var TrickleCompletionHandler = _.extend({

        isStepLocking: false,
        isCompleted: false,
        
        stepModel: null,
        
        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.getCompletionAttribute();
            this.setupEventListeners();
        },

        getCompletionAttribute: function() {
            var trickle = Adapt.trickle.getModelConfig(Adapt.config);
            if (!trickle) return;
            if (trickle._completionAttribute) {
                completionAttribute = trickle._completionAttribute
            }
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:descendants": this.onDescendants,
                "trickle:steplock": this.onStepLock,
                "trickle:stepunlock": this.onStepUnlock,
                "trickle:kill": this.onKill,
                "remove": this.onRemove
            });
        },

        onDescendants: function(view) {
            //save the original completion state of the component before steplocking
            view.descendantsParentFirst.each(_.bind(function(descendant) {
                var trickle = Adapt.trickle.getModelConfig(descendant);
                if (!trickle) return;
                trickle._wasCompletedPreRender = descendant.get(completionAttribute);
            }, this));
        },

        onStepLock: function(view) {
            var isModelComplete = view.model.get(completionAttribute);

            var trickle = Adapt.trickle.getModelConfig(view.model);
            if (!trickle._stepLocking._isCompletionRequired
                && !trickle._stepLocking._isLockedOnRevisit) {
                if (isModelComplete) {
                    //skip any components that do not require completion but that are already complete
                    //this is needed for a second visit to a page with 'inview' components that aren't reset and don't require completion and are not relocked on revisit
                    Adapt.trigger("trickle:continue", view);
                }
                return;
            }

            if (trickle._stepLocking._isCompletionRequired
                && isModelComplete
                && trickle._wasCompletedPreRender) {
                //skip any components that are complete, have require completion and we completed before the page rendered
                Adapt.trigger("trickle:continue", view);
                return;
            }

            Adapt.trigger("trickle:wait");

            if (isModelComplete) {
                _.defer(function() {
                    Adapt.trigger("trickle:unwait")
                });
                return;
            }

            view.model.set("_isTrickleAutoScrollComplete", false);
            this.isCompleted = false;
            this.isStepLocking = true;
            this.stepModel = view.model;

            this.listenTo(this.stepModel, "change:"+completionAttribute, this.onCompletion);
        },

        onCompletion: function(model, value) {
            if (value === false) return;

            _.defer(_.bind(function() {
                this.stepCompleted();
            }, this));

        },

        stepCompleted: function() {

            if (!this.isStepLocking) return;

            if (this.isCompleted) return;
            this.isCompleted = true;

            this.stopListening(this.stepModel, "change:"+completionAttribute, this.onCompletion);
            
            _.defer(function(){
                Adapt.trigger("trickle:unwait");
            });
        },

        onKill: function() {
            this.onStepUnlock();
        },

        onRemove: function() {
            this.onStepUnlock();
        },

        onStepUnlock: function() {
            this.stopListening(this.stepModel, "change:"+completionAttribute, this.onCompletion);
            this.isStepLocking = false;
            this.stepModel = null;
            this.isCompleted = false;
        }        

    }, Backbone.Events);

    TrickleCompletionHandler.initialize();

    return TrickleCompletionHandler;

});

define('extensions/adapt-contrib-trickle/js/handlers/notify',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleNotifyHandler = _.extend({

        isStepLocking: false,
        isNotifyOpen: false,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:steplock": this.onStepLock,
                "notify:opened": this.onNotifyOpened,
                "notify:closed": this.onNotifyClosed,
                "trickle:stepunlock": this.onStepUnlock,
                "remove": this.onRemove
            });
        },

        onStepLock: function(view) {
            this.isStepLocking = true;
        },

        onNotifyOpened: function() {
            if (!this.isStepLocking) return;

            this.isNotifyOpen = true;
            Adapt.trigger("trickle:overlay");
            Adapt.trigger("trickle:wait");
        },

        onNotifyClosed: function() {
            if (!this.isStepLocking) return;
            if (!this.isNotifyOpen) return;

            this.isNotifyOpen = false;
            Adapt.trigger("trickle:unoverlay");
            Adapt.trigger("trickle:unwait");
        },

        onStepUnlock: function() {
            this.isStepLocking = false;
        },

        onRemove: function() {
            this.onStepUnlock();
        }

    }, Backbone.Events);

    TrickleNotifyHandler.initialize();

    return TrickleNotifyHandler;

});

define('extensions/adapt-contrib-trickle/js/handlers/resize',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleBodyResizeHandler = _.extend({

        isStepLocking: false,

        stepView: null,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.debounceOnResize();
            this.setupEventListeners();
        },

        debounceOnResize: function() {
            this.onResize = _.debounce(_.bind(this.onResize, this), 10);
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:steplock": this.onStepLock,
                "trickle:resize": this.onTrickleResize,
                "trickle:stepunlock": this.onStepUnlock,
                "trickle:kill": this.onKill,
                "trickle:finished": this.onFinished,
                "remove": this.onRemove
            });
        },

        onStepLock: function(view) {
            this.isStepLocking = true;
            this.stepView = view;
            $(window).on("resize", this.onResize);
            $(".page").on("resize", this.onResize);

            //wait for height / visibility to adjust
            _.defer(function() {
                Adapt.trigger("trickle:resize");
            });
        },

        onResize: function() {
            if (!this.isStepLocking) return;
            Adapt.trigger("trickle:resize");
        },

        onTrickleResize: function() {
            if (!this.isStepLocking) return;
            var offset = this.stepView.$el.offset();
            var height = this.stepView.$el.height();

            var topPadding = parseInt($("#wrapper").css("padding-top") || "0");

            var bottom = (offset['top'] - topPadding) + height;

            $("#wrapper").css("height", bottom );
        },

        onStepUnlock: function(view) {
            this.isStepLocking = false;
            this.stepView = null;
            $(window).off("resize", this.onResize);
            $(".page").off("resize", this.onResize);
        },

        onKill: function() {
            this.onFinished();
            this.onStepUnlock();
        },

        onFinished: function() {
             $("#wrapper").css("height", "" );
        },

        onRemove: function() {
            this.onStepUnlock();
            this.stepView = null;
        }

    }, Backbone.Events);

    TrickleBodyResizeHandler.initialize();

    return TrickleBodyResizeHandler;

});

define('extensions/adapt-contrib-trickle/js/handlers/tutor',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleTutorHandler = _.extend({

        stepLockedId: null,
        isStepLocking: false,
        isTutorOpen: false,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:steplock": this.onStepLock,
                "tutor:opened": this.onTutorOpened,
                "tutor:closed": this.onTutorClosed,
                "trickle:stepunlock": this.onStepUnlock,
                "remove": this.onRemove
            });
        },

        onStepLock: function(view) {
            if (view) {
                this.stepLockedId = view.model.get("_id");
            }
            this.isStepLocking = true;
        },

        onTutorOpened: function(view, alertObject) {
            if (!this.isStepLocking) return;
            if (!this.isOriginStepLocked(view)) return;

            this.isTutorOpen = true;
            Adapt.trigger("trickle:overlay");
            Adapt.trigger("trickle:wait");
        },

        isOriginStepLocked: function(view) {
            if (!view || !this.stepLockedId) return true;

            var parents = view.model.getParents();
            var hasStepLockedParent = parents.findWhere({_id:this.stepLockedId});
            if (!hasStepLockedParent) return false;
            return true;
        },

        onTutorClosed: function(view, alertObject) {
            if (!this.isStepLocking) return;
            if (!this.isTutorOpen) return;
            if (!this.isOriginStepLocked(view)) return;

            this.isTutorOpen = false;
            Adapt.trigger("trickle:unoverlay");
            Adapt.trigger("trickle:unwait");
        },

        onStepUnlock: function() {
            this.isStepLocking = false;
            this.stepLockedId = null;
        },

        onRemove: function() {
            this.onStepUnlock();
        }

    }, Backbone.Events);

    TrickleTutorHandler.initialize();

    return TrickleTutorHandler;

});

define('extensions/adapt-contrib-trickle/js/handlers/visibility',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleVisibilityHandler = _.extend({

        isStepLocking: false,

        trickleModel: null,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, {
                "trickle:steplock": this.onStepLock,
                "trickle:visibility": this.onVisibility,
                "trickle:stepunlock": this.onStepUnlock,
                "trickle:kill": this.onKill,
                "trickle:finished": this.onFinished,
                "remove": this.onRemove
            });

        },

        onStepLock: function(view) {
            this.isStepLocking = true;
            this.trickleModel = view.model;
            Adapt.trigger("trickle:visibility");
        },

        onVisibility: function() {
            if (!this.isStepLocking) return;

            if (!Adapt.trickle.pageView) return;

            var descendantsParentFirst = Adapt.trickle.pageView.descendantsParentFirst;

            var trickleModelId = this.trickleModel.get("_id");
            var trickleType = this.trickleModel.get("_type");

            var atIndex = _.findIndex(descendantsParentFirst.models, function(descendant) {
                if (descendant.get("_id") === trickleModelId) return true;
            });

            descendantsParentFirst.each(function(descendant, index) {
                if (index <= atIndex) {
                    descendant.set("_isVisible", true, {pluginName:"trickle"});
                    var components = descendant.findDescendants("components");
                    components.each(function(componentModel) {
                        componentModel.set("_isVisible", true, {pluginName:"trickle"});
                    });
                } else {

                    if (trickleType === "article" && descendant.get("_type") === "block") {
                        //make sure article blocks are shown
                        if (descendant.get("_parentId") === trickleModelId) {
                            descendant.set("_isVisible", true, {pluginName:"trickle"});
                            var components = descendant.findDescendants("components");
                            components.each(function(componentModel) {
                                componentModel.set("_isVisible", true, {pluginName:"trickle"});
                            });
                            return;
                        }
                    }

                    descendant.set("_isVisible", false, {pluginName:"trickle"});
                    var components = descendant.findDescendants("components");
                    components.each(function(componentModel) {
                        componentModel.set("_isVisible", false, {pluginName:"trickle"});
                    });
                }
            });

        },

        onStepUnlock: function(view) {
            this.isStepLocking = false;
            this.trickleModel = null;
        },

        onKill: function() {
            this.onFinished();
            this.onStepUnlock();
        },

        onFinished: function() {

            var descendantsParentFirst = Adapt.trickle.pageView.descendantsParentFirst;

            descendantsParentFirst.each(function(descendant) {
                descendant.set("_isVisible", true, {pluginName:"trickle"});
                var components = descendant.findDescendants("components");
                components.each(function(componentModel) {
                    componentModel.set("_isVisible", true, {pluginName:"trickle"});
                });
            });

        },

        onRemove: function() {
            this.onStepUnlock();
        }

    }, Backbone.Events);

    TrickleVisibilityHandler.initialize();

    return TrickleVisibilityHandler;

});

define('extensions/adapt-contrib-trickle/js/handlers/done',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleDone = _.extend({

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onAppDataReady);
        },

        onAppDataReady: function() {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.onDone = _.debounce(_.bind(this.onDone), 50);
            this.listenTo(Adapt, {
                "trickle:steplock": this.onDone,
                "trickle:stepunlock": this.onDone,
                "trickle:continue": this.onDone,
                "trickle:finished": this.onDone
            });
        },

        onDone: function() {
            Adapt.trigger("trickle:done");
        }

    }, Backbone.Events);

    TrickleDone.initialize();

    return TrickleDone;

});

define('extensions/adapt-contrib-trickle/js/adapt-contrib-trickle',[
    'coreJS/adapt',
    './pageView',
    'libraries/jquery.resize',
    './lib/adaptModelExtension',
    './handlers/button',
    './handlers/completion',
    './handlers/notify',
    './handlers/resize',
    './handlers/tutor',
    './handlers/visibility',
    './handlers/done'
], function(Adapt, PageView) {

    Adapt.trickle = _.extend({

        model: null,
        pageView: null,

        initialize: function() {
            this.listenToOnce(Adapt, {
                "app:dataReady": this.onAppDataReady
            });
        },

        onAppDataReady: function() {
            this.getCourseModel();
            if (!this.isCourseEnabled()) return;
            this.setupListeners();
        },

        getCourseModel: function() {
            this.model = Adapt.course;
        },

        isCourseEnabled: function() {
            var trickleConfig = this.getModelConfig(this.model);
            if (trickleConfig && trickleConfig._isEnabled === false) return false;
            return true;
        },

        getModelConfig: function(model) {
            return model.get("_trickle");
        },

        setModelConfig: function(model, config) {
            return model.set("_trickle", config);
        },

        setupListeners: function() {
            this.listenTo(Adapt, {
                "pageView:preRender": this.onPagePreRender,
                "remove": this.onRemove
            });
        },

        onPagePreRender: function(view) {
            this.pageView = new PageView({
                model: view.model, 
                el: view.el
            });
        },

        scroll: function(fromModel) {
            //wait for model visibility to handle
            _.delay(_.bind(function() {

                if (!this.shouldScrollPage(fromModel)) return;

                var trickle = Adapt.trickle.getModelConfig(fromModel);
                var scrollTo = trickle._scrollTo;
                if (scrollTo === undefined) scrollTo = "@block +1";

                fromModel.set("_isTrickleAutoScrollComplete", true);

                var scrollToId = "";
                switch (scrollTo.substr(0,1)) {
                case "@":
                    //NAVIGATE BY RELATIVE TYPE
                    
                    //Allows trickle to scroll to a sibling / cousin component relative to the current trickle item
                    var relativeModel = fromModel.findRelative(scrollTo, {
                        filterNotAvailable: true
                    });
                    
                    if (relativeModel === undefined) return;
                    scrollToId = relativeModel.get("_id");

                    //console.log("trickle scrolling to", scrollToId, "from", fromModel.get("_id"));

                    break;
                case ".":
                    //NAVIGATE BY CLASS
                    scrollToId = scrollTo.substr(1, scrollTo.length-1);
                    break;
                default: 
                    scrollToId = scrollTo;
                }

                if (scrollToId == "") return;
                
                var duration = fromModel.get("_trickle")._scrollDuration || 500;
                Adapt.scrollTo("." + scrollToId, { duration: duration });

            }, this), 250);
        },

        shouldScrollPage: function(fromModel) {
            var trickle = Adapt.trickle.getModelConfig(fromModel);
            if (!trickle || !trickle._isEnabled) return false;

            var hasScrolled = fromModel.get("_isTrickleAutoScrollComplete");
            if (hasScrolled) return false;

            var isAutoScrollOff = (!trickle._autoScroll);
            if (isAutoScrollOff) return false;

            var isArticleWithOnChildren = (fromModel.get("_type") === "article" && trickle._onChildren);
            if (isArticleWithOnChildren) return false;

            return true;
        },

        onRemove: function() {
            
        }
                
    }, Backbone.Events);

    Adapt.trickle.initialize();

    return Adapt.trickle;

});

define('extensions/adapt-contrib-tutor/js/adapt-contrib-tutor',[
    'coreJS/adapt'
],function(Adapt) {

    Adapt.on('questionView:showFeedback', function(view) {

        var alertObject = {
            title: view.model.get("feedbackTitle"),
            body: view.model.get("feedbackMessage")
        };

        if (view.model.has('_isCorrect')) {
            // Attach specific classes so that feedback can be styled.
            if (view.model.get('_isCorrect')) {
                alertObject._classes = 'correct';
            } else {
                if (view.model.has('_isAtLeastOneCorrectSelection')) {
                    // Partially correct feedback is an option.
                    alertObject._classes = view.model.get('_isAtLeastOneCorrectSelection')
                        ? 'partially-correct'
                        : 'incorrect';
                } else {
                    alertObject._classes = 'incorrect';
                }
            }
        }

        Adapt.once("notify:closed", function() {
            Adapt.trigger("tutor:closed", view, alertObject);
        });

        Adapt.trigger('notify:popup', alertObject);

        Adapt.trigger('tutor:opened', view, alertObject);
    });

});

define('extensions/adapt-devtools/js/devtools-model',['require','coreJS/adapt'],function(require) {

	var Adapt = require('coreJS/adapt');

	var DevtoolsModel = Backbone.Model.extend({

		initialize:function() {
			var config = Adapt.config.has('_devtools') ? Adapt.config.get('_devtools') : this.getDefaultConfig();
			this.set(_.extend({
				'_trickleEnabled':false,
				'_hintingAvailable':true,
				'_hintingEnabled':false,
				'_toggleFeedbackAvailable':true,
				'_feedbackEnabled':true,
				'_autoCorrectAvailable':true,
				'_autoCorrectEnabled':false,
				'_altTextAvailable':true,
				'_altTextEnabled':false,
				'_tutorListener':null,
				'_unlockAvailable':true,
				'_unlocked':false,
				'_toggleBankingAvailable':true
			}, config));
		},

		getDefaultConfig:function() {
			return {
				'_isEnabled':false,
				'_theme':'theme-dark'
			};
		},

		toggleFeedback:function() {
			this.set('_feedbackEnabled', !this.get('_feedbackEnabled'));
		},

		toggleHinting:function() {
			this.set('_hintingEnabled', !this.get('_hintingEnabled'));
		},

		toggleAutoCorrect:function() {
			this.set('_autoCorrectEnabled', !this.get('_autoCorrectEnabled'));
		},

		toggleAltText:function() {
			this.set('_altTextEnabled', !this.get('_altTextEnabled'));
		}
	});

	return DevtoolsModel;
});

define('extensions/adapt-devtools/js/hinting',['require','coreJS/adapt'],function(require) {

	var Adapt = require('coreJS/adapt');

	var Hinting = _.extend({

		initialize:function() {
			this.listenTo(Adapt.devtools, 'change:_hintingEnabled', this.toggleHints);
		},

		toggleHints:function() {
			var contentObject = Adapt.findById(Adapt.location._currentId);
			var components = contentObject.findDescendants('components');
			var renderedQuestions = components.where({'_isQuestionType':true, '_isReady':true});

			_.each(renderedQuestions, function(model) {
				this.setHinting($('.'+model.get('_id')), model, Adapt.devtools.get('_hintingEnabled'));
			}, this);

			if (Adapt.devtools.get('_hintingEnabled')) this.listenTo(Adapt, 'componentView:postRender', this.onComponentRendered);
			else this.stopListening(Adapt, 'componentView:postRender');
		},

		onComponentRendered:function(view, hintingEnabled) {
			if (view.model.get('_isQuestionType')) this.setHinting(view.$el, view.model);
		},

		setHinting:function($el, model, hintingEnabled) {
			switch (model.get('_component')) {
				case 'mcq':this.setMcqHinting($el, model, hintingEnabled !== false); break;
				case 'gmcq':this.setGmcqHinting($el, model, hintingEnabled !== false); break;
				case 'matching':this.setMatchingHinting($el, model, hintingEnabled !== false); break;
				case 'slider':this.setSliderHinting($el, model, hintingEnabled !== false); break;
				case 'textinput':this.setTextInputHinting($el, model, hintingEnabled !== false); break;
				case 'questionStrip':this.setQuestionStripHinting($el, model, hintingEnabled !== false); break;
			}
		},

		setMcqHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				_.each(model.get('_items'), function(item, index) {
					$el.find('.mcq-item').eq(index).addClass(item._shouldBeSelected ? 'hintCorrect' : 'hintIncorrect');
				});
			}
			else {
				$el.find('.mcq-item').removeClass('hintCorrect hintIncorrect');
			}
		},

		setGmcqHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				_.each(model.get('_items'), function(item, index) {
					$el.find('.gmcq-item').eq(index).addClass(item._shouldBeSelected ? 'hintCorrect' : 'hintIncorrect');
				});
			}
			else {
				$el.find('.gmcq-item').removeClass('hintCorrect hintIncorrect');
			}
		},

		setMatchingHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				_.each(model.get('_items'), function(item, itemIndex) {
					var $select = $el.find('select').eq(itemIndex);
					var $options = $select.find('option');
					_.each(item._options, function(option, optionIndex) {
						/*if (Modernizr.touch) {*/
							if (option._isCorrect) $options.eq(optionIndex+1).append('<span class="hint"> (correct)</span>');
						/*}
						else {
							$options.eq(optionIndex+1).addClass(option._isCorrect ? 'hintCorrect' : 'hintIncorrect');
						}*/
					});
				});
			}
			else {
				/*if (Modernizr.touch) */$el.find('option .hint').remove();
				/*else $el.find('option').removeClass('hintCorrect hintIncorrect');*/
			}
		},

		setSliderHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				var correctAnswer = model.get('_correctAnswer');
				if (correctAnswer) {
					$el.find('.slider-scale-number').addClass('hintIncorrect');
					$el.find('.slider-scale-number[data-id="'+correctAnswer+'"]').removeClass('hintIncorrect').addClass('hintCorrect');
				}
				else {
					$el.find('.slider-scale-number').addClass('hintIncorrect');
					var bottom = model.get('_correctRange')._bottom;
	        		var top = model.get('_correctRange')._top;
	        		for (var i = bottom; i <= top; i++)
	        			$el.find('.slider-scale-number[data-id="'+i+'"]').removeClass('hintIncorrect').addClass('hintCorrect');
				}
			}
			else {
				$el.find('.slider-scale-number').removeClass('hintCorrect hintIncorrect');
			}
		},

		setTextInputHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				_.each(model.get('_items'), function(item, index) {
					if (model.get('_answers')) {
						// generic answers
						$el.find('.textinput-item').eq(index).find('input').attr('placeholder', model.get('_answers')[index][0]);
					}
					else {
						// specific answers
						$el.find('.textinput-item').eq(index).find('input').attr('placeholder', item._answers[0]);
					}
				});
			}
			else {
				_.each(model.get('_items'), function(item, index) {
					if (model.get('_answers')) {
						$el.find('.textinput-item').eq(index).find('input').attr('placeholder', item.placeholder);
					}
				});
			}
		},

		setQuestionStripHinting:function($el, model, hintingEnabled) {
			if (hintingEnabled) {
				_.each(model.get('_items'), function(item, itemIndex) {
					var $item = $el.find('.component-item').eq(itemIndex);
					var $subItems = $item.find('.qs-strapline-header-inner:not(.qs-noop) .qs-strapline-title-inner');
					_.each(item._subItems, function(subItem, subItemIndex) {
						if (subItem._isCorrect) $subItems.eq(subItemIndex).append('<span class="hint"> (correct)</span>');
					});
				});
			}
			else {
				$el.find('.qs-strapline-title-inner .hint').remove();
			}
		}
	}, Backbone.Events);

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		Hinting.initialize();
	});

	return Hinting;
});

define('extensions/adapt-devtools/js/is-question-supported',['require'],function(require) {
	function isQuestionSupported(model) {
		switch (model.get('_component')) {
			case 'mcq':
			case 'gmcq':
			case 'matching':
			case 'slider':
			case 'textinput':
			case 'questionStrip':return true;
			default: return false;
		}
	}

	return isQuestionSupported;
});
define('extensions/adapt-devtools/js/auto-answer',['require','coreJS/adapt','./hinting','./is-question-supported'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Hinting = require('./hinting');
	var isQuestionSupported = require('./is-question-supported');

	var AutoAnswer = _.extend({

		initialize:function() {
			this.listenTo(Adapt, 'componentView:postRender', this.componentRendered);
		},

		componentRendered:function(view) {
			if (isQuestionSupported(view.model)) {
				if (view.buttonsView) {
					view.$('.buttons-action').on('mousedown', _.bind(this.onSubmitClicked, this, view));
				}
				else if (Adapt.devtools.get('_debug')) {
					console.warn('adapt-devtools: could not find submit button on '+view.model.get('_id'));
				}
			}
		},

		onSubmitClicked:function(view, e) {
			// remove hinting if enabled
			if (Adapt.devtools.get('_hintingEnabled')) Hinting.setHinting(view.$el, view.model, false);

			if ((e.ctrlKey && !e.shiftKey) || Adapt.devtools.get('_autoCorrectEnabled')) {
				this.answer(view);
			}
			else if (e.ctrlKey && e.shiftKey) {
				this.answer(view, true);
			}
		},

		answer:function(view, incorrectly) {
			if (view.model.get('_isSubmitted')) return;

			if (Adapt.devtools.get('_debug')) {
				console.log('adapt-devtools: answer '+view.model.get('_id')+(incorrectly === true ? ' incorrectly' : ''));
			}

			if (incorrectly === true) {
				switch (view.model.get('_component')) {
					case 'mcq':this.answerMultipleChoiceIncorrectly(view); break;
					case 'gmcq':this.answerMultipleChoiceIncorrectly(view, true); break;
					case 'matching':this.answerMatchingIncorrectly(view); break;
					case 'slider':this.answerSliderIncorrectly(view); break;
					case 'textinput':this.answerTextInputIncorrectly(view); break;
					case 'questionStrip':this.answerQuestionStripIncorrectly(view); break;
					default:this.answerUnsupportedIncorrectly(view);
				}
			}
			else {
				switch (view.model.get('_component')) {
					case 'mcq':this.answerMultipleChoice(view); break;
					case 'gmcq':this.answerMultipleChoice(view, true); break;
					case 'matching':this.answerMatching(view); break;
					case 'slider':this.answerSlider(view); break;
					case 'textinput':this.answerTextInput(view); break;
					case 'questionStrip':this.answerQuestionStrip(view); break;
					default:this.answerUnsupported(view);
				}
			}
		},

		answerMultipleChoice:function(view, isGraphical) {
			_.each(view.model.get('_items'), function(item, index) {
				if (item._shouldBeSelected && !item._isSelected || !item._shouldBeSelected && item._isSelected) {
					view.$(isGraphical ? '.gmcq-item input' : '.mcq-item input').eq(index).trigger('change');
				}
			});
		},

		answerMultipleChoiceIncorrectly:function(view, isGraphical) {
			var model = view.model, items = model.get('_items'), itemCount = items.length;
			var selectionStates = _.times(itemCount, function() {return false;});
			// number of items that should be selected
			var nShould = _.where(items, {_shouldBeSelected:true}).length;
			// and number that should not
			var nShouldNot = itemCount - nShould;
			// decide how many items to select
			var nSelect = model.get('_selectable');
			// decide how many of these should be incorrect
			var nIncorrect = nShouldNot == 0 ? 0 : _.random(nShould == 1 ? 1 : 0, Math.min(nShouldNot, nSelect));
			// and how many should be correct
			var nCorrect = nIncorrect == 0 ? _.random(1, Math.min(nShould - 1, nSelect)) : _.random(0, Math.min(nShould, nSelect - nIncorrect));

			if (itemCount == 1 || nSelect == 0) {
				console.warn('adapt-devtools: not possible to answer '+model.get('_id')+' incorrectly');
				return;
			}

			for (var j = 0; j < nIncorrect; j++) {
				// start at a random position in items to avoid bias (err is contingency for bad data)
				for (var k=_.random(itemCount), err=itemCount, found=false; !found && err>=0; k++, err--) {
					var index = k%itemCount;
					if (selectionStates[index] === false) {
						if (!items[index]._shouldBeSelected) selectionStates[index] = found = true;
					}
				}
			}
			for (var j = 0; j < nCorrect; j++) {
				// start at a random position in items to avoid bias (err is contingency for bad data)
				for (var k=_.random(itemCount), err=itemCount, found=false; !found && err>=0; k++, err--) {
					var index = k%itemCount;
					if (selectionStates[index] === false) {
						if (items[index]._shouldBeSelected) selectionStates[index] = found = true;
					}
				}
			}

			_.each(items, function(item, index) {
				if (selectionStates[index] && !item._isSelected || !selectionStates[index] && item._isSelected) {
					view.$(isGraphical ? '.gmcq-item input' : '.mcq-item input').eq(index).trigger('change');
				}
			});
		},

		answerMatching:function(view) {
			_.each(view.model.get('_items'), function(item, itemIndex) {
				var $select = view.$('select').eq(itemIndex);
				var $options = $select.find('option');
				_.each(item._options, function(option, optionIndex) {
					if (option._isCorrect) $options.eq(optionIndex+1).prop('selected', true);
				});
			});
		},

		answerMatchingIncorrectly:function(view) {
			var items = view.model.get('_items'), itemCount = items.length, nIncorrect = _.random(1, itemCount);
			// decide which items to answer incorrectly (minimum one)
			var selectionStates = _.shuffle(_.times(itemCount, function(i) {return i<nIncorrect;}));

			_.each(items, function(item, itemIndex) {
				var $select = view.$('select').eq(itemIndex);
				var $options = $select.find('option');
				// check if this item is to be answered incorrectly
				if (selectionStates[itemIndex]) {
					// start at a random position in options to avoid bias (err is contingency for bad data)
					for (var count=item._options.length, i=_.random(count), err=count; err>=0; i++, err--)
						if (!item._options[i%count]._isCorrect) {
							$options.eq((i%count)+1).prop('selected', true);
							return;
						}
				}
				else {
					_.each(item._options, function(option, optionIndex) {
						if (option._isCorrect) $options.eq(optionIndex+1).prop('selected', true);
					});
				}
			});
		},

		answerSlider:function(view) {
			var correctAnswer = view.model.get('_correctAnswer');
			if (correctAnswer) {
				view.$('.slider-scale-number[data-id="'+correctAnswer+'"]').trigger('click');
			}
			else {
				var bottom = view.model.get('_correctRange')._bottom;
        		var top = view.model.get('_correctRange')._top;
        		var d = top - bottom;
        		// select from range at random
        		view.$('.slider-scale-number[data-id="'+(bottom+Math.floor(Math.random()*(d+1)))+'"]').trigger('click');
			}
		},

		answerSliderIncorrectly:function(view) {
			var correctAnswer = view.model.get('_correctAnswer');
			var start = view.model.get('_scaleStart'), end = view.model.get('_scaleEnd');
			var incorrect = _.times(end-start+1, function(i) {return start+i;});
			if (correctAnswer) {
				incorrect.splice(correctAnswer-start, 1);
			}
			else {
				var bottom = view.model.get('_correctRange')._bottom;
        		var top = view.model.get('_correctRange')._top;
        		incorrect.splice(bottom-start, top-bottom+1);
			}
			view.$('.slider-scale-number[data-id="'+_.shuffle(incorrect)[0]+'"]').trigger('click');
		},

		answerTextInput:function(view) {
			var answers = view.model.get('_answers');
			_.each(view.model.get('_items'), function(item, index) {
				if (answers) view.$('.textinput-item input').eq(index).val(answers[index][0]); // generic answers
				else view.$('.textinput-item input').eq(index).val(item._answers[0]); // specific answers
			});
		},

		answerTextInputIncorrectly:function(view) {
			var items = view.model.get('_items'), itemCount = items.length, nIncorrect = _.random(1, itemCount);
			// decide which items to answer incorrectly (minimum one)
			var selectionStates = _.shuffle(_.times(itemCount, function(i) {return i<nIncorrect;}));
			var answers = view.model.get('_answers');
			_.each(items, function(item, index) {
				if (selectionStates[index]) {
					view.$('.textinput-item input').eq(index).val('***4n 1nc0rr3ct 4nsw3r***'); // probably
				}
				else {
					if (answers) view.$('.textinput-item input').eq(index).val(answers[index][0]);
					else view.$('.textinput-item input').eq(index).val(item._answers[0]);
				}
			});
		},

		answerQuestionStrip:function(view) {
			_.each(view.model.get('_items'), function(item, itemIndex) {
				_.each(item._subItems, function(subItem, subItemIndex) {
					if (subItem._isCorrect) view.setStage(itemIndex, subItemIndex, true);
				});
			});
		},

		answerQuestionStripIncorrectly:function(view) {
			var items = view.model.get('_items'), itemCount = items.length, nIncorrect = _.random(1, itemCount);
			// decide which items to answer incorrectly (minimum one)
			var selectionStates = _.shuffle(_.times(itemCount, function(i) {return i<nIncorrect;}));

			_.each(items, function(item, itemIndex) {
				// check if this item is to be answered incorrectly
				if (selectionStates[itemIndex]) {
					// start at a random position in subitems to avoid bias (err is contingency for bad data)
					for (var count=item._subItems.length, i=_.random(count), err=count; err>=0; i++, err--)
						if (!item._subItems[i%count]._isCorrect) {
							view.setStage(itemIndex, i%count, true);
							return;
						}
				}
				else {
					_.each(item._subItems, function(subItem, subItemIndex) {
						if (subItem._isCorrect) view.setStage(itemIndex, subItemIndex, true);
					});
				}
			});
		},

		answerUnsupported:function(view) {
			var model = view.model;

			model.set({"_isComplete":true, "_isInteractionComplete":true, "_isCorrect":true, "_isSubmitted":true, "_score":1});
			model.set("_attemptsLeft", Math.max(0, model.get("_attempts") - 1));
		},

		answerUnsupportedIncorrectly:function(view) {
			var model = view.model;
			
			model.set({"_isComplete":true, "_isInteractionComplete":true, "_isCorrect":false, "_isSubmitted":true, "_score":0});
			model.set("_attemptsLeft", Math.max(0, model.get("_attempts") - 1));
		}
	}, Backbone.Events);
	
	Adapt.on('app:dataReady devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		AutoAnswer.initialize();
	});

	return AutoAnswer;
});

define('extensions/adapt-devtools/js/pass-half-fail',['require','coreJS/adapt','./auto-answer'],function(require) {

	var Adapt = require('coreJS/adapt');
	var AutoAnswer = require('./auto-answer');

	var PassHalfFail = _.extend({
		initialize:function() {
			this._questionViews = [];
			this._currentPageId = null;
			this.listenTo(Adapt, 'pageView:preRender', this.onPagePreRender);
			this.listenTo(Adapt, 'remove', this.onRemove);
		},

		_completeNonQuestions:function() {
			var currentModel = Adapt.findById(Adapt.location._currentId);
			var nonQuestions = currentModel.findDescendants("components").filter(function(m) {return m.get('_isQuestionType') !== true;});

			_.each(nonQuestions, function(item) {
				item.set("_isComplete", true);
				item.set("_isInteractionComplete", true);
			});
		},

		pass:function(callback) {
			var i = 0, qs = this._questionViews, len = qs.length;

			//this._completeNonQuestions();

			// async to avoid locking up the interface
			function step() {
				for (var j=0, count=Math.min(2, len-i); j < count; i++, j++) {
					AutoAnswer.answer(qs[i]);
					if (!qs[i].model.get('_isSubmitted')) qs[i].$('.buttons-action').trigger('click');
				}
				i == len ? callback() : setTimeout(step);
			}

			step();
		},

		half:function(callback) {
			var notSubmitted = function(view) {return !view.model.get('_isSubmitted')};
			var qs = _.shuffle(_.filter(this._questionViews, notSubmitted));
			var i = 0, len = qs.length;

			//this._completeNonQuestions();

			// async to avoid locking up the interface
			function step() {
				for (var j=0, count=Math.min(2, len-i); j < count; i++, j++) {
					AutoAnswer.answer(qs[i], i % 2 == 0);
					if (!qs[i].model.get('_isSubmitted')) qs[i].$('.buttons-action').trigger('click');
				}
				i == len ? callback() : setTimeout(step);
			}

			step();
		},

		fail:function(callback) {
			var i = 0, qs = this._questionViews, len = qs.length;

			//this._completeNonQuestions();

			// async to avoid locking up the interface
			function step() {
				for (var j=0, count=Math.min(2, len-i); j < count; i++, j++) {
					AutoAnswer.answer(qs[i], true);
					if (!qs[i].model.get('_isSubmitted')) qs[i].$('.buttons-action').trigger('click');
				}
				i == len ? callback() : setTimeout(step);
			}

			step();
		},

		onPagePreRender:function(view) {
			this._currentPageId = view.model.get('_id');
			this.listenTo(Adapt, 'componentView:postRender', this.onComponentRendered);
		},

		onRemove:function() {
			this.stopListening(Adapt, 'componentView:postRender', this.onComponentRendered);
			this._questionViews = [];
		},

		onComponentRendered:function(view) {
			// check component is part of current page
			if (view.model.has('_parentId') && view.model.findAncestor('contentObjects').get('_id') == this._currentPageId) {
				if (view.model.get('_isQuestionType')) {
					this._questionViews.push(view);
				}
			}
		}
	}, Backbone.Events);

	Adapt.on('app:dataReady devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		PassHalfFail.initialize();
	});

	return PassHalfFail;
});

define('extensions/adapt-devtools/js/toggle-banking',['require','coreJS/adapt','coreJS/router'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Router = require('coreJS/router');

	var ToggleBanking = {

		initialize:function() {
			Adapt.articles.each(function(m) {
				var config = this.getConfig(m);
				if (m.has('_assessment') && m.get('_assessment')._banks && !m.get('_assessment')._banks._isEnabled) {
					config._assessmentBankDisabled = true;
				}
			}, this);
		},

		getConfig:function(articleModel) {
			if (!articleModel.has('_devtools')) articleModel.set('_devtools', {});
			return articleModel.get('_devtools');
		},

		getBankedAssessmentsInCurrentPage:function() {
			var pageModel = Adapt.findById(Adapt.location._currentId);
			var f = function(m) {
				config = this.getConfig(m);
				if (!config._assessmentBankDisabled &&
					m.has('_assessment') &&
					m.get('_assessment')._isEnabled &&
					m.get('_assessment')._banks._split.length > 1) return true;

				return false;
			};

			return Adapt.location._contentType == 'menu' ? [] : pageModel.findDescendants('articles').filter(f, this);
		},

		toggle:function() {
			var bankedAssessments = this.getBankedAssessmentsInCurrentPage();
			var isBankingEnabled = function(m) {return m.get('_assessment')._banks._isEnabled;};
			var enable = !bankedAssessments.some(isBankingEnabled);

			_.each(bankedAssessments, function(articleModel) {
				articleModel.get('_assessment')._banks._isEnabled = enable;
				// set properties to trigger setup of assessment data
				articleModel.set({'_attemptInProgress':false, '_isPass':false});
			});

			// reload page
			Router.handleId(Adapt.location._currentId);
		}
	};

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		ToggleBanking.initialize();
	});

	return ToggleBanking;
});

define('extensions/adapt-devtools/js/map',['require','coreJS/adapt','coreJS/router'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Router = require('coreJS/router');

	var MapView = Backbone.View.extend({
		events: {
			'click a':'onLinkClicked'
		},

		initialize: function() {
			this.$('html').addClass('devtools-map');
			this._renderIntervalId = setInterval(_.bind(this._checkRenderInterval, this), 500);
			this.listenTo(Adapt.components, 'change:_isComplete', this.onModelCompletionChanged);
			this.listenTo(Adapt.blocks, 'change:_isComplete', this.onModelCompletionChanged);
			this.listenTo(Adapt.articles, 'change:_isComplete', this.onModelCompletionChanged);
			this.listenTo(Adapt.contentObjects, 'change:_isComplete', this.onModelCompletionChanged);
			this.render();
		},

		render: function() {
			var config = Adapt.devtools;
            var data = this.model;
            var startTime = new Date().getTime();

            var template = Handlebars.templates['devtoolsMap'];
            this.$('body').addClass(config.has('_theme') ? config.get('_theme') : 'theme-light');
            this.$('body').html(template(data));

            //console.log('adapt-devtools: map rendered in ' + ((new Date().getTime())-startTime) + ' ms');
		},

		remove: function() {
			clearInterval(this._renderIntervalId);
            this.$('body').html('Course closed!');
            this.stopListening();
            return this;
        },

		_checkRenderInterval:function() {
			if (this._invalid) {
				this._invalid = false;
				this.render();
			}
		},

		_getConfig:function(pageModel) {
			if (!pageModel.has('_devtools')) pageModel.set('_devtools', {});
			return pageModel.get('_devtools');
		},

		_disablePageIncompletePrompt:function(pageModel) {
			var config = this._getConfig(pageModel);

			if (pageModel.has('_pageIncompletePrompt')) {
				config._pageIncompletePromptExists = true;
				if (pageModel.get('_pageIncompletePrompt').hasOwnProperty('_isEnabled')) {
					config._pageIncompletePromptEnabled = pageModel.get('_pageIncompletePrompt')._isEnabled;
				}
			}
			else {
				config._pageIncompletePromptExists = false;
				pageModel.set('_pageIncompletePrompt', {});
			}

			pageModel.get('_pageIncompletePrompt')._isEnabled = false;
		},

		_restorePageIncompletePrompt:function(pageModel) {
			var config = this._getConfig(pageModel);

			if (config._pageIncompletePromptExists) {
				if (config.hasOwnProperty('_pageIncompletePromptEnabled')) pageModel.get('_pageIncompletePrompt')._isEnabled = config._pageIncompletePromptEnabled;
				else delete pageModel.get('_pageIncompletePrompt')._isEnabled;
			}
			else {
				pageModel.unset('_pageIncompletePrompt');
			}
			delete config._pageIncompletePromptExists;
			delete config._pageIncompletePromptEnabled;
		},

		onModelCompletionChanged:function() {
			this.invalidate();
		},

		onLinkClicked:function(e) {
			var $target = $(e.currentTarget);
			var id = $target.attr("href").slice(1);
			var model = Adapt.findById(id);

			e.preventDefault();
			
			if (e.ctrlKey && this.el.defaultView) {
				id = id.replace(/-/g, '');
				this.el.defaultView[id] = model;
				this.el.defaultView.console.log('devtools: add property window.'+id+':');
				this.el.defaultView.console.log(model);
			}
			else if (e.shiftKey) {
				this.navigateAndDisableTrickle(id);
			}
			else {
				this.navigateAndDisableTrickleUpTo(id);
			}
		},

		invalidate:function() {
			this._invalid = true;
		},

		/**
		* Navigate to the element with the given id (or as closely to it as possible). Disable trickle up to the given id.
		* N.B. because trickle cannot be reliably manipulated in situ we must reload the page. Trickle remains disabled on
		* affected article(s)|block(s).
		*/
		navigateAndDisableTrickleUpTo:function(id) {
			var model = Adapt.findById(id);
			var pageModel = Adapt.findById(Adapt.location._currentId);

			// first ensure page incomplete prompt won't activate
			this._disablePageIncompletePrompt(pageModel);

			// now navigate

			if (model._siblings == 'contentObjects') {
				Backbone.history.navigate("#/id/"+id, {trigger:true});
			}
			else {
				var level = model.get('_type') == 'component' ? model.getParent() : model;
				var siblings = level.getParent().getChildren(), sibling = null;
				// disable trickle on all preceeding article(s)|block(s)
				for (var i=0, count=siblings.indexOf(level); i < count; i++) {
					sibling = siblings.at(i);
					console.log('disabling trickle on '+sibling.get('_id'));
					if (sibling.has('_trickle')) {
						sibling.get('_trickle')._isEnabled = false;
					}
					else {
						sibling.set('_trickle', {_isEnabled:false});
					}
				}
				// check if already on page
				if (Adapt.location._currentId == model.findAncestor('contentObjects').get('_id')) {
					this.listenToOnce(Adapt, 'pageView:ready', function(view) {
						_.defer(_.bind(function() {
							Adapt.scrollTo($('.'+id));
							this.checkVisibility(id);
						}, this));
					});
					if (Adapt.location._currentId == Adapt.course.get('_id')) Router.handleRoute ? Router.handleRoute() : Router.handleCourse();
					else Router.handleId(Adapt.location._currentId);
				}
				else {
					this.listenToOnce(Adapt, 'pageView:ready', function() {
						_.defer(_.bind(function() {
							this.checkVisibility(id);
						}, this));
					});
					Backbone.history.navigate("#/id/"+id, {trigger:true});
				}
			}

			// restore pageIncompletePrompt config
			this._restorePageIncompletePrompt(pageModel);

			this.invalidate();
		},

		/**
		* Navigate to the element with the given id (or as closely to it as possible). Disable trickle on containing
		* page temporarily.
		*/
		navigateAndDisableTrickle:function(id) {
			var model = Adapt.findById(id);
			var pageModel = Adapt.findById(Adapt.location._currentId);

			// first ensure page incomplete prompt won't activate
			this._disablePageIncompletePrompt(pageModel);

			if (model._siblings == 'contentObjects') {
				Backbone.history.navigate("#/id/"+id, {trigger:true});
			}
			else {
				// if already on page ensure trickle is disabled
				if (Adapt.location._currentId == model.findAncestor('contentObjects').get('_id')) {
					Adapt.devtools.set('_trickleEnabled', false);
					Adapt.scrollTo($('.'+id));
					this.checkVisibility(id);
				}
				else {
					// pick target model to determine trickle config according to trickle version (2.1 or 2.0.x)
					var targetModel = Adapt.trickle ? model.findAncestor('contentObjects') : Adapt.course;
					
					// if necessary disable trickle (until page is ready)
					if (!targetModel.has('_trickle')) {
						targetModel.set('_trickle', {_isEnabled:false});
						this.listenToOnce(Adapt, 'pageView:ready', function() {
							_.defer(_.bind(function() {
								targetModel.get('_trickle')._isEnabled = true;
								this.checkVisibility(id);
							}, this));
						});
					}
					else if (targetModel.get('_trickle')._isEnabled) {
						targetModel.get('_trickle')._isEnabled = false;
						this.listenToOnce(Adapt, 'pageView:ready', function() {
							_.defer(_.bind(function() {
								targetModel.get('_trickle')._isEnabled = true;
								this.checkVisibility(id);
							}, this));
						});
					}

					Backbone.history.navigate("#/id/"+id, {trigger:true});
				}
			}

			// restore pageIncompletePrompt config
			this._restorePageIncompletePrompt(pageModel);

			this.invalidate();
		},

		checkVisibility:function(id) {
			var model = Adapt.findById(id);
			if ($('.'+id).is(':visible') || model == Adapt.course) return;

			while (!$('.'+id).is(':visible') && model != Adapt.course) {
				model = model.getParent();
				id = model.get('_id');
			}
			console.log('adapt-devtools::checkVisibility scrolling to ancestor '+id);
			Adapt.scrollTo($('.'+id));
		}
	});

	var Map = _.extend({
		initialize: function() {
			this.listenTo(Adapt, 'devtools:mapLoaded', this.onMapLoaded);
			$(window).on('unload', _.bind(this.onCourseClosed, this));

			function isMenu(options) {
				if (this.get('_type') !== 'page') {
                    return options.fn(this);
                } else {
                    return options.inverse(this);
                }
			}

			function eachChild(options) {
			    var ret = "";
			    var children = this.get('_children').models;
			    
			    for (var i = 0, j = children.length; i < j; i++) {
			        ret = ret + options.fn(children[i], {data:{index:i,first:i==0,last:i===j-1}});
			    }

			    return ret;
			}

			function getProp(prop, options) {
				return this.get(prop);
			}

			function isStringEmpty(str) {
				return !str || (str.trim && str.trim().length == 0) || ($.trim(str).length == 0)
			}

			function getTitle(options) {
				var t = this.get('displayTitle');
				if (isStringEmpty(t)) t = this.get('title');
				if (isStringEmpty(t)) t = this.get('_id');
				return t;
			}

			function when(prop, options) {
				if (this.get(prop)) {
                    return options.fn(this);
                } else {
                    return options.inverse(this);
                }
			}

			function isTrickled(options) {
				var trickleConfig = this.get('_trickle');
				var trickled = false;
				var isBlock = this.get('_type') == 'block';

				if (trickleConfig) trickled = (isBlock || trickleConfig._onChildren !== true) && trickleConfig._isEnabled;
				else if (isBlock) {
					trickleConfig = this.getParent().get('_trickle');
					if (trickleConfig) trickled = trickleConfig._onChildren && trickleConfig._isEnabled;
				}

				if (trickled) {
                    return options.fn(this);
                } else {
                    return options.inverse(this);
                }
			}

			Handlebars.registerHelper('isMenu', isMenu);
			Handlebars.registerHelper('eachChild', eachChild);
			Handlebars.registerHelper('getProp', getProp);
			Handlebars.registerHelper('getTitle', getTitle);
			Handlebars.registerHelper('when', when);
			Handlebars.registerHelper('isTrickled', isTrickled);
		},

		open:function() {
			if (!this.mapWindow) {
				this.mapWindow = window.open('assets/map.html', 'Map');
			}
			else {
				this.mapWindow.focus();
			}
		},

		onMapClosed: function() {
			console.log('onMapClosed');
			this.mapWindow = null;
		},

		onMapLoaded: function(mapWindow) {
			console.log('onMapLoaded');
			this.mapWindow = mapWindow;
			this.mapWindow.focus();
			$('html', this.mapWindow.document).addClass($('html', window.document).attr('class'));
			this.mapView = new MapView({model:Adapt, el:this.mapWindow.document});
			$(this.mapWindow).on('unload', _.bind(this.onMapClosed, this));
        },

        onCourseClosed:function() {
        	if (this.mapView) {
        		this.mapView.remove();
        		//this.mapWindow.close();
        	}
        }
	}, Backbone.Events);

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		Map.initialize();
	});

	return Map;
});

define('extensions/adapt-devtools/js/utils',['require','coreJS/adapt','coreModels/adaptModel','coreViews/questionView'],function(require) {

	var Adapt = require('coreJS/adapt');
	var AdaptModel = require('coreModels/adaptModel');
	var QuestionView = require('coreViews/questionView');
	
	// control-click to access Adapt model
	function onDocumentClicked(e) {
		if (e.ctrlKey) {
			var $target = $(e.target);

			function getModel($el, t) {
				if ($el.length == 0) return false; 
				var re = new RegExp('[\\s]+('+t+'\\-[^\\s]+)');
				var id = re.exec($el.attr('class'))[1];
				var model = id.slice(t.length+1) == Adapt.course.get('_id') ? Adapt.course : Adapt.findById(id);
				if (model) {
					id = model.get('_id').replace(/-/g, '');
					window[id] = model;
					console.log('devtools: add property window.'+id+':');
					console.log(model);
				}
				return true;
			}
			
			if (getModel($target.parents('.component'), 'c')) return;
			if (getModel($target.parents('.block'), 'b')) return;
			if (getModel($target.parents('.article'), 'a')) return;
			if (getModel($target.parents('.page'), 'co')) return;
			if (getModel($target.parents('.menu'), 'menu')) return;
		}
	}

	function getAdaptCoreVersion() {
		try {
			if (typeof AdaptModel.prototype.setCompletionStatus == 'function') return ">=v2.0.10";
			if (typeof AdaptModel.prototype.checkLocking == 'function') return "v2.0.9";
			if (typeof Adapt.checkingCompletion == 'function') return "v2.0.8";
			if (typeof AdaptModel.prototype.getParents == 'function') return "v2.0.7";
			if ($.a11y && $.a11y.options.hasOwnProperty('isIOSFixesEnabled')) return "v2.0.5-v2.0.6";
			if (Adapt instanceof Backbone.Model) return "v2.0.4";
			if (typeof QuestionView.prototype.recordInteraction == 'function') return "v2.0.2-v2.0.3";
			if (typeof Adapt.findById == 'function') return "v2.0.0-v2.0.1";
			return "v1.x";
		}
		catch (e) {
			return 'unknown version';
		}
	}

	Adapt.once('adapt:initialize', function() {
		var str = 'Version of Adapt core detected: '+getAdaptCoreVersion();
		var horz = getHorzLine();

		console.log(horz+'\nVersion of Adapt core detected: '+getAdaptCoreVersion()+'\n'+horz);

		function getHorzLine() {
			for (var s='', i=0, c=str.length; i<c; i++) s+='*';
			return s;
		}
	});

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		$(document).on('click', onDocumentClicked);

		// useful for command-line debugging
		if (!window.a) window.a = Adapt;
	});
});

define('extensions/adapt-devtools/js/end-trickle',['require','coreJS/adapt'],function(require) {

	var Adapt = require('coreJS/adapt');

	function onTrickleBegun() {
		if (!Adapt.devtools.get('_trickleEnabled')) {
			console.log('Trickle started');
			Adapt.devtools.set('_trickleEnabled', true);
			// listen for user request to end trickle
			Adapt.devtools.once('change:_trickleEnabled', onTrickleChange);
		}
	}

	function onTrickleEnded() {
		console.log('Trickle ended');
		Adapt.devtools.off('change:_trickleEnabled', onTrickleChange);
		Adapt.devtools.set('_trickleEnabled', false);
	}

	function onTrickleChange() {
		if (!Adapt.devtools.get('_trickleEnabled')) {
			// user triggered
			Adapt.trigger('trickle:kill');
		}
	}

	function remove() {
		if (Adapt.devtools.get('_trickleEnabled')) {
			onTrickleEnded();
		}
	}

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		Adapt.on('trickle:interactionInitialize trickle:started', onTrickleBegun);
		Adapt.on('trickle:kill trickle:finished', onTrickleEnded);
		Adapt.on('remove', remove);
	});
});

define('extensions/adapt-devtools/js/toggle-feedback',['require','coreJS/adapt'],function(require) {

	var Adapt = require('coreJS/adapt');

	function onShowFeedback() {
		// trickle waits for tutor to close so pretend that this happens
		//Adapt.trigger('tutor:opened'); trickle-tutorPlugin doesn't actually listen to this(!)
		Adapt.trigger('tutor:closed');
	}

	function hushTutor() {
		Adapt.devtools.set('_tutorListener', Adapt._events['questionView:showFeedback'].pop());
		Adapt.on('questionView:showFeedback', onShowFeedback);
	}

	function reinstateTutor() {
		Adapt.off('questionView:showFeedback', onShowFeedback);

		if (!Adapt._events.hasOwnProperty('questionView:showFeedback')) {
			Adapt._events['questionView:showFeedback'] = [];
		}

		Adapt._events['questionView:showFeedback'].push(Adapt.devtools.get('_tutorListener'));
	}

	function onFeedbackToggled() {
		if (Adapt.devtools.get('_feedbackEnabled')) {
			reinstateTutor();
			$(document).off('mouseup', '.buttons-feedback');
		}
		else {
			hushTutor();
			$(document).on('mouseup', '.buttons-feedback', onFeedbackButtonClicked);
		}
	}

	function onFeedbackButtonClicked(e) {
		var classes = $(e.currentTarget).parents('.component').attr('class');
		var componentId = /[\s]+(c\-[^\s]+)/.exec(classes)[1];
		
		if (componentId) {
			// bring tutor back temporarily
			reinstateTutor();
			// tutor expects a view, but it's not actually needed
			Adapt.trigger('questionView:showFeedback', {model:Adapt.findById(componentId)});
			// and hush it again
			hushTutor();
		}
		else console.error('devtools:onFeedbackButtonClicked: malformed component class name');
	}
	
	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		if (Adapt.devtools.get('_toggleFeedbackAvailable')) {
			// assume single registrant is adapt-contrib-tutor
			if (Adapt._events.hasOwnProperty('questionView:showFeedback') && Adapt._events['questionView:showFeedback'].length == 1) {
				Adapt.devtools.on('change:_feedbackEnabled', onFeedbackToggled);
			}
			else {
				console.warn('devtools: no tutor or multiple registrants of questionView:showFeedback so disabling ability to toggle feedback.');
				Adapt.devtools.set('_toggleFeedbackAvailable', false);
			}
		}
	});
});

define('extensions/adapt-devtools/js/toggle-alt-text',['require','coreJS/adapt'],function(require) {

	var Adapt = require('coreJS/adapt');

	var AltText = _.extend({

		initialize:function() {
			this.listenTo(Adapt.devtools, 'change:_altTextEnabled', this.toggleAltText);

			// if available we can use to avoid unnecessary checks
			if (typeof MutationObserver == 'function') {
				this.observer = new MutationObserver(_.bind(this.onDomMutation, this));
			}
		},

		addTimer:function(fireNow) {
			this.timerId = setInterval(_.bind(this.onTimer, this), 1000);
			if (fireNow) this.onTimer();
		},

		removeTimer:function() {
			clearInterval(this.timerId);
		},

		connectObserver:function() {
			if (this.observer) this.observer.observe(document.getElementById('wrapper'), {
				childList: true,
				subtree:true,
				attributes:true,
				attributeFilter:['class', 'style']
			});
		},

		disconnectObserver:function() {
			if (this.observer) this.observer.disconnect();
		},

		toggleAltText:function() {
			if (Adapt.devtools.get('_altTextEnabled')) {
				this.addTimer(true);
				this.connectObserver();
			}
			else {
				this.removeTimer();
				this.removeAllAnnotations();
				this.disconnectObserver();
			}
		},

		addAnnotation:function($img, $annotation) {
			var template = Handlebars.templates['devtoolsAnnotation'];
			var text = $img.attr('alt');

			if (!text) text = $img.attr('aria-label');
			
			var $annotation = $(template({text:text}));

			if (!text) $annotation.addClass('devtools-annotation-warning');

			$img.after($annotation);
			$img.data('annotation', $annotation);

			this.updateAnnotation($img, $annotation);
		},

		removeAnnotation:function($img, $annotation) {
			$annotation.remove();
			$img.removeData('annotation');
		},

		removeAllAnnotations:function() {
			$('img').each(_.bind(function(index, element) {
				var $img = $(element);
				var $annotation = $img.data('annotation');

				if ($annotation) this.removeAnnotation($img, $annotation);
			}, this));
		},

		updateAnnotation:function($img, $annotation) {
			var position = $img.position();
			position.left += parseInt($img.css('marginLeft'), 10) + parseInt($img.css('paddingLeft'), 10);
			position.top += parseInt($img.css('marginTop'), 10) + parseInt($img.css('paddingTop'), 10);
			$annotation.css(position);
		},

		onDomMutation:function(mutations) {
			this.mutated = true;
		},

		onTimer:function() {
			if (this.mutated === false) return;
			if (this.observer) this.mutated = false;

			//console.log('devtools::toggle-alt-text:run check');

			this.disconnectObserver();

			$('img').each(_.bind(function(index, element) {
				var $img = $(element);
				var $annotation = $img.data('annotation');
				var isVisible = $img.is(':visible');

				if (isVisible) {
					if (!$annotation) this.addAnnotation($img, $annotation);
					else this.updateAnnotation($img, $annotation);
				}
				else if ($annotation) {
					this.removeAnnotation($img, $annotation);
				}
			}, this));

			this.connectObserver();
		}
	}, Backbone.Events);

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		AltText.initialize();
	});

	return AltText;
});
define('extensions/adapt-devtools/js/unlock',['require','coreJS/adapt','coreJS/router'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Router = require('coreJS/router');

	function breakCoreLocking() {
		Adapt.course.unset('_lockType');

		breakLocks(Adapt.contentObjects);
		breakLocks(Adapt.articles);
		breakLocks(Adapt.blocks);

		function breakLocks(collection) {
			collection.each(function(model) {
				model.unset('_lockType');
				model.unset('_isLocked');
			});
		}
	}

	function onUnlocked() {
		if (Adapt.devtools.get('_unlocked')) {
			breakCoreLocking();
			// reload the page/menu
			if (Adapt.location._currentId == Adapt.course.get('_id')) Router.handleRoute ? Router.handleRoute() : Router.handleCourse();
			else Router.handleId(Adapt.location._currentId);
		}
	}

	// menu unlock legacy (for courses authored prior to v2.0.9 or which otherwise do not use core locking)
	function onMenuPreRender(view) {
		if (Adapt.devtools.get('_unlocked')) {
			if (Adapt.location._currentId == view.model.get('_id')) {
				view.model.once('change:_isReady', _.bind(onMenuReady, view));
				view.model.getChildren().each(function(item) {
					// first pass: attempt to manipulate commonly employed locking mechanisms
					if (item.has('_lock')) item.set('_lock', item.get('_lock').length > -1 ? [] : false);
					if (item._lock) item._lock = item._lock.length > -1 ? [] : false;
					if (item._locked === true) item._locked = false;
					if (item._isLocked === true) item._isLocked = false;
				});
			}
		}
	}

	// menu unlock legacy (for courses authored prior to v2.0.9 or which otherwise do not use core locking)
	function onMenuReady() {
		if (Adapt.devtools.get('_unlocked')) {
			// second pass: attempt to enable clickable elements
			this.$('a, button').prop('disabled', false).css('pointer-events', 'auto');
		}
	}

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;

		if (Adapt.devtools.get('_unlockAvailable')) {
			Adapt.devtools.on('change:_unlocked', onUnlocked);
			Adapt.on('menuView:preRender', onMenuPreRender);
		}
	});
});

define('extensions/adapt-devtools/js/enable',['require','coreJS/adapt','coreJS/router'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Router = require('coreJS/router');

	var buffer = '';
	var isMouseDown = false;

	function onKeypress(e) {
		var c = String.fromCharCode(e.which).toLowerCase();
		buffer += c;
		if (isMouseDown && c == '5' && !Adapt.devtools.get('_isEnabled')) enable();
		else processBuffer();
	}

	function onMouseDown() {
		isMouseDown = true;
	}

	function onMouseUp() {
		isMouseDown = false;
	}
	
	function processBuffer() {
		var blen = buffer.length;
		if (blen > 100) buffer = buffer.substr(1,100);
		blen = buffer.length;

		if (buffer.substr( blen - ("kcheat").length, ("kcheat").length  ) == "kcheat") {
			if (!Adapt.devtools.get('_isEnabled')) enable();
		}
	}

	function enable() {
		removeHooks();
		Adapt.devtools.set('_isEnabled', true);
		Adapt.trigger('devtools:enable');

		// reload the menu/page
		if (Adapt.location._currentId == Adapt.course.get('_id')) Router.handleRoute ? Router.handleRoute() : Router.handleCourse();
		else Router.handleId(Adapt.location._currentId);
	}

	function addHooks() {
		$(window).on("keypress", onKeypress);
		$(window).on("mousedown", onMouseDown);
		$(window).on("mouseup", onMouseUp);

		window.kcheat = function() {
			buffer = "kcheat";
			processBuffer();
		};

		Router.route('kcheat', 'kcheat', function() {
			if (window.kcheat) window.kcheat();
		});
	}

	function removeHooks() {
		$(window).off("keypress", onKeypress);
		$(window).off("mousedown", onMouseDown);
		$(window).off("mouseup", onMouseUp);
		window.kcheat = undefined;
	}

	Adapt.once('adapt:initialize', function() {
		if (Adapt.devtools.get('_isEnabled')) return;

		// some plugins (e.g. bookmarking) will manipulate the router so defer the call
		_.defer(function () {addHooks();});
	});
});

/*
* adapt-devtools
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Chris Steele <chris.steele@kineo.com>, Oliver Foster <oliver.foster@kineo.com>
*/

define('extensions/adapt-devtools/js/adapt-devtools',[
	'coreJS/adapt',
	'coreModels/adaptModel',
	'./devtools-model',
	'./pass-half-fail',
	'./toggle-banking',
	'./map',
	'./auto-answer',
	'./utils',
	'./end-trickle',
	'./hinting',
	'./toggle-feedback',
	'./toggle-alt-text',
	'./unlock',
	'./enable'
], function(Adapt, AdaptModel, DevtoolsModel, PassHalfFail, ToggleBanking, Map) {

	var DevtoolsView = Backbone.View.extend({

		className:'devtools',

		events:{
			'click .end-trickle':'onEndTrickle',
			'change .hinting input':'onToggleHinting',
			'change .banking input':'onToggleBanking',
			'change .feedback input':'onToggleFeedback',
			'change .auto-correct input':'onToggleAutoCorrect',
			'change .alt-text input':'onToggleAltText',
			'click .unlock':'onUnlock',
			'click .open-map':'onOpenMap',
			'click .complete-page':'onCompletePage',
			'click .pass':'onPassHalfFail',
			'click .half':'onPassHalfFail',
			'click .fail':'onPassHalfFail'
		},

		initialize:function() {
			this.render();

			this._checkUnlockVisibility();
			this._checkTrickleEndVisibility();
			this._checkBankingVisibility();
			this._checkFeedbackVisibility();
			this._checkHintingVisibility();
			this._checkAutoCorrectVisibility();
			this._checkAltTextVisibility();
			this._checkPassHalfFailVisibility();
			this._checkCompletePageVisibility();
		},

		render:function() {
			var data = Adapt.devtools.toJSON();
			var template = Handlebars.templates['devtools'];
            this.$el.html(template(data));
			return this;
		},

		/*************************************************/
		/********************* UNLOCK ********************/
		/*************************************************/

		_checkUnlockVisibility:function() {
			// check if function available and not already activated
			if (!Adapt.devtools.get('_unlockAvailable') || Adapt.devtools.get('_unlocked')) this.$('.unlock').addClass('display-none');
			else this.$('.unlock').toggleClass('display-none', !this._checkForLocks());
		},

		_checkForLocks:function() {
			if (typeof AdaptModel.prototype.checkLocking != 'function') return Adapt.location._contentType == 'menu';

			var hasLock = function(model) {return model.has('_lockType');};

			if (hasLock(Adapt.course)) return true;
			if (Adapt.contentObjects.some(hasLock)) return true;
			if (Adapt.articles.some(hasLock)) return true;
			if (Adapt.blocks.some(hasLock)) return true;

			return false;
		},

		onUnlock:function() {
			Adapt.devtools.set('_unlocked', true);
			this._checkUnlockVisibility();
		},

		/*************************************************/
		/********************** MAP **********************/
		/*************************************************/

		onOpenMap:function() {
			Map.open();
			Adapt.trigger('drawer:closeDrawer');
		},

		/*************************************************/
		/******************** TRICKLE ********************/
		/*************************************************/

		_checkTrickleEndVisibility:function() {
			this.$('.end-trickle').toggleClass('display-none', !Adapt.devtools.get('_trickleEnabled'));
		},

		onEndTrickle:function() {
			Adapt.devtools.set('_trickleEnabled', false);
			this._checkTrickleEndVisibility();
		},

		/*************************************************/
		/*************** QUESTION BANKING ****************/
		/*************************************************/

		_checkBankingVisibility:function() {
			if (!Adapt.devtools.get('_toggleFeedbackAvailable')) {
				this.$('.banking').addClass('display-none');
				return;
			}

			var bankedAssessments = ToggleBanking.getBankedAssessmentsInCurrentPage();
			var isBankingEnabled = function(m) {return m.get('_assessment')._banks._isEnabled;};

			if (bankedAssessments.length > 0) {
				this.$('.banking').removeClass('display-none');
				this.$('.banking label').toggleClass('selected', bankedAssessments.some(isBankingEnabled));
			}
			else {
				this.$('.banking').addClass('display-none');
			}
		},

		onToggleBanking:function() {
			ToggleBanking.toggle();
			this._checkBankingVisibility();
		},

		/*************************************************/
		/*********** QUESTION FEEDBACK (TUTOR) ***********/
		/*************************************************/

		_checkFeedbackVisibility:function() {
			if (Adapt.devtools.get('_toggleFeedbackAvailable')) {
				this.$('.feedback').removeClass('display-none');
				this.$('.feedback label').toggleClass('selected', Adapt.devtools.get('_feedbackEnabled'));
			}
			else {
				this.$('.feedback').addClass('display-none');
			}
		},

		onToggleFeedback:function() {
			Adapt.devtools.toggleFeedback();
			this._checkFeedbackVisibility();
		},

		/*************************************************/
		/*************** QUESTION HINTING ****************/
		/*************************************************/

		_checkHintingVisibility:function() {
			if (Adapt.devtools.get('_hintingAvailable')) {
				this.$('.hinting').removeClass('display-none');
				this.$('.hinting label').toggleClass('selected', Adapt.devtools.get('_hintingEnabled'));
			}
			else {
				this.$('.hinting').addClass('display-none');
			}
		},

		onToggleHinting:function() {
			Adapt.devtools.toggleHinting();
			this._checkHintingVisibility();
		},

		/*************************************************/
		/***************** AUTO CORRECT ******************/
		/*************************************************/

		_checkAutoCorrectVisibility:function() {
			if (Adapt.devtools.get('_autoCorrectAvailable')) {
				this.$('.toggle.auto-correct').removeClass('display-none');
				this.$('.toggle.auto-correct label').toggleClass('selected', Adapt.devtools.get('_autoCorrectEnabled'));
				this.$('.tip.auto-correct').toggleClass('display-none', Adapt.devtools.get('_autoCorrectEnabled'));
			}
			else {
				this.$('.auto-correct').addClass('display-none');
			}
		},

		onToggleAutoCorrect:function() {
			Adapt.devtools.toggleAutoCorrect();
			this._checkAutoCorrectVisibility();
		},

		/*************************************************/
		/******************* ALT TEXT ********************/
		/*************************************************/

		_checkAltTextVisibility:function() {
			if (Adapt.devtools.get('_altTextAvailable')) {
				this.$('.toggle.alt-text').removeClass('display-none');
				this.$('.toggle.alt-text label').toggleClass('selected', Adapt.devtools.get('_altTextEnabled'));
				this.$('.tip.alt-text').toggleClass('display-none', Adapt.devtools.get('_altTextEnabled'));
			}
			else {
				this.$('.alt-text').addClass('display-none');
			}
		},

		onToggleAltText:function() {
			Adapt.devtools.toggleAltText();
			this._checkAltTextVisibility();
		},

		/*************************************************/
		/***************** COMPLETE PAGE *****************/
		/*************************************************/

		_checkCompletePageVisibility:function() {
			var currentModel = Adapt.findById(Adapt.location._currentId);

			if (currentModel.get('_type') != 'page') {
				this.$('.complete-page').addClass('display-none');
				return;
			}

			var cond = currentModel.has('_isInteractionsComplete') ? {'_isInteractionsComplete':false} : {'_isInteractionComplete':false};
			var incomplete = currentModel.findDescendants('components').where(cond);

			this.$('.complete-page').toggleClass('display-none', incomplete.length == 0);

		},

		onCompletePage:function(e) {
			var currentModel = Adapt.findById(Adapt.location._currentId);

			if (Adapt.devtools.get('_trickleEnabled')) Adapt.trigger("trickle:kill");

			var cond = currentModel.has('_isInteractionsComplete') ? {'_isInteractionsComplete':false} : {'_isInteractionComplete':false};
			var incomplete = currentModel.findDescendants('components').where(cond);

			_.each(incomplete, function(component) {
				if (component.get('_isQuestionType')) {
					component.set("_isCorrect", true);
					component.set("_isSubmitted", true);
					component.set("_score", 1);
					component.set("_attemptsLeft", Math.max(0, component.set("_attempts") - 1));
				}
				
				component.set("_isComplete", true);
				component.set(currentModel.has('_isInteractionsComplete') ? '_isInteractionsComplete' : '_isInteractionComplete', true);
			});

			Adapt.trigger('drawer:closeDrawer');
		},

		/************************************************************/
		/******* Similar to original adapt-cheat functionality ******/
		/************************************************************/

		_checkPassHalfFailVisibility:function() {
			var currentModel = Adapt.findById(Adapt.location._currentId);

			if (currentModel.get('_type') != 'page') {
				this.$('.pass, .half, .fail').addClass('display-none');
				return;
			}

			var unanswered = currentModel.findDescendants('components').where({'_isQuestionType':true, '_isSubmitted':false});
			
			if (unanswered.length == 0)	this.$('.tip.pass-half-fail').html('');
			else this.$('.tip.pass-half-fail').html('With the '+unanswered.length+' unanswered question(s) in this page do the following:');

			this.$('.pass, .half, .fail').toggleClass('display-none', unanswered.length == 0);

		},

		onPassHalfFail:function(e) {
			if (Adapt.devtools.get('_trickleEnabled')) Adapt.trigger("trickle:kill");

			// potentially large operation so show some feedback
			$('.loading').show();

			var tutorEnabled = Adapt.devtools.get('_feedbackEnabled');

			if (tutorEnabled) Adapt.devtools.set('_feedbackEnabled', false);

			if ($(e.currentTarget).hasClass('pass')) PassHalfFail.pass(_.bind(this.onPassHalfFailComplete, this, tutorEnabled));
			else if ($(e.currentTarget).hasClass('half')) PassHalfFail.half(_.bind(this.onPassHalfFailComplete, this, tutorEnabled));
			else PassHalfFail.fail(_.bind(this.onPassHalfFailComplete, this, tutorEnabled));

			Adapt.trigger('drawer:closeDrawer');
		},

		onPassHalfFailComplete:function(tutorEnabled) {
			console.log('onPassHalfFailComplete');

			if (tutorEnabled) Adapt.devtools.set('_feedbackEnabled', true);

			$('.loading').hide();
		}
	});

	var DevtoolsNavigationView = Backbone.View.extend({

		initialize:function() {
			var template = Handlebars.templates.devtoolsNavigation;

			this.$el = $(template());

			$('html').addClass('devtools-enabled');

			if (this.$el.is('a') || this.$el.is('button')) this.$el.on('click', _.bind(this.onDevtoolsClicked, this));
			else this.$el.find('a, button').on('click', _.bind(this.onDevtoolsClicked, this));

			// keep drawer item to left of PLP, resources, close button etc
			this.listenTo(Adapt, 'pageView:postRender menuView:postRender', this.onContentRendered);
		},

		render:function() {
	        $('.navigation-inner').append(this.$el);
			return this;
		},

		deferredRender:function() {
			_.defer(_.bind(this.render, this));
		},

		onContentRendered:function(view) {
			if (view.model.get('_id') == Adapt.location._currentId) {
				this.stopListening(view.model, 'change:_isReady', this.deferredRender);
				this.listenToOnce(view.model, 'change:_isReady', this.deferredRender);
			}
		},

		onDevtoolsClicked:function(event) {
			if(event && event.preventDefault) event.preventDefault();
            Adapt.drawer.triggerCustomView(new DevtoolsView().$el, false);
		}
	});

	Adapt.once('courseModel:dataLoaded', function() {
		Adapt.devtools = new DevtoolsModel();
	});

	Adapt.once('adapt:initialize devtools:enable', function() {
		if (!Adapt.devtools.get('_isEnabled')) return;
		
		new DevtoolsNavigationView();
	});
});

;define('extensions/adapt-editorial/js/lib/Backbone.Inherit',['backbone'],function(Backbone){

	var Inherit = {};

	Inherit.prototype = {

		//calls overridden inherited functions on Backbone.Model, Backbone.Router or Backbone.View 
		//allows behaviour to be encapsulated in a single extend layer and brought forward to extended layers

		ascend: function(name, callback, defer) {

			var binder = function() {

				//fetch all the inherited parents and store them on the object
				if (!this.hasOwnProperty('_inheritParents')) {
					this._inheritParents = Inherit.prototype.getInheritParents.call(this);
				}

				var returnValue;
				var deferedParents = [];

				//itereate through the inherited parents
				for (var i = 0, l = this._inheritParents.length; i < l; i++) {
					var parent = this._inheritParents[i];
					var parentReturnValue;

					//check if the parent has the function requested
					if (!parent.hasOwnProperty(binder._callbackName)) continue;

					var callbackFunctionAtParent = parent[binder._callbackName];
					if (!callbackFunctionAtParent) continue;

					//check if the parent function is already ascend/descend bound
					if (callbackFunctionAtParent._performsInherited) {
						//if the parent function should be defered, add it to the defer list
						if (callbackFunctionAtParent._defer) {
							deferedParents.push(parent);
							continue;
						}

						//call the parent function without triggering the cascade backwards
						parentReturnValue = callbackFunctionAtParent._callback.apply(this, arguments);
					} else {

						//the parent function is not bound by ascend/descend so it can be called directly
						parentReturnValue = callbackFunctionAtParent.apply(this, arguments);
					}

					//merge the return value from the parent function into any existing return value
					returnValue = mergeReturnValues(parentReturnValue, returnValue);
				}

				//perform the same routine on the defered parent functions
				for (var i = 0, l = deferedParents.length; i < l; i++) {
					var parent = deferedParents[i];
					var parentReturnValue;
					if (!parent.hasOwnProperty(binder._callbackName)) continue;
					var callbackFunctionAtParent = parent[binder._callbackName];
					if (!callbackFunctionAtParent) continue;
					if (callbackFunctionAtParent._performsInherited) {
						parentReturnValue = callbackFunctionAtParent._callback.apply(this, arguments);
					} else {
						parentReturnValue = callbackFunctionAtParent.apply(this, arguments);
					}
					returnValue = mergeReturnValues(parentReturnValue, returnValue);
				}

				return returnValue;
			};
			//setup the binder function with the appropriate variables
			binder._performsInherited = true;
			binder._callback = callback;
			binder._callbackName = name;
			binder._defer = defer;

			return binder;

		},

		descend: function(name, callback, defer) {

			var binder = function() {

				//fetch all the inherited parents and store them on the object
				if (!this.hasOwnProperty('_inheritParents')) {
					this._inheritParents = Inherit.prototype.getInheritParents.call(this);
				}

				var returnValue;
				var deferedParents = [];

				//itereate through the inherited parents
				for (var i = this._inheritParents.length-1, l = -1; i > l; i--) {
					var parent = this._inheritParents[i];
					var parentReturnValue;

					//check if the parent has the function requested
					if (!parent.hasOwnProperty(binder._callbackName)) continue;

					var callbackFunctionAtParent = parent[binder._callbackName];
					if (!callbackFunctionAtParent) continue;

					//check if the parent function is already ascend/descend bound
					if (callbackFunctionAtParent._performsInherited) {
						//if the parent function should be defered, add it to the defer list
						if (callbackFunctionAtParent._defer) {
							deferedParents.push(parent);
							continue;
						}

						//call the parent function without triggering the cascade backwards
						parentReturnValue = callbackFunctionAtParent._callback.apply(this, arguments);
					} else {

						//the parent function is not bound by ascend/descend so it can be called directly
						parentReturnValue = callbackFunctionAtParent.apply(this, arguments);
					}

					//merge the return value from the parent function into any existing return value
					returnValue = mergeReturnValues(parentReturnValue, returnValue);
				}

				//perform the same routine on the defered parent functions
				for (var i = 0, l = deferedParents.length; i < l; i++) {
					var parent = deferedParents[i];
					var parentReturnValue;
					if (!parent.hasOwnProperty(binder._callbackName)) continue;
					var callbackFunctionAtParent = parent[binder._callbackName];
					if (!callbackFunctionAtParent) continue;
					if (callbackFunctionAtParent._performsInherited) {
						parentReturnValue = callbackFunctionAtParent._callback.apply(this, arguments);
					} else {
						parentReturnValue = callbackFunctionAtParent.apply(this, arguments);
					}
					returnValue = mergeReturnValues(parentReturnValue, returnValue);
				}

				return returnValue;
			};
			//setup the binder function with the appropriate variables
			binder._performsInherited = true;
			binder._callback = callback;
			binder._callbackName = name;
			binder._defer = defer;

			return binder;

			
		},

		//fetches all of the inherited prototypes from the Backbone.Model, Backbone.Router or Backbone.View
		getInheritParents: function() {

			//step back through the inheritance chain and collect all of the inherited parents
			var parents = [ this.constructor.prototype ];
			var parent = this.constructor.__super__;
			parents.unshift(parent)
			while (parent.constructor && parent.constructor.__super__) {
				var parent = parent.constructor.__super__;
				parents.unshift(parent);
			}
			return parents;

		}
		
	};

	Inherit.extend = function(to) {
		return _.extend({}, Inherit.prototype, to);
	};

	//extend Backbone with the three functions ascend, descend and getInheritParents
	_.extend(Backbone, Inherit.prototype);

	/* result
	* Backbone.ascend("functionName", function(sharedArgument) {
	*
	* });
	* Backbone.descend("functionName", function(sharedArgument) {
	*
	* });
	* Backbone.getInheritedParents.call(backboneObject);
	*/

	//merge return values together
	function mergeReturnValues(into, using) {

		var typeofInto = typeof into;
		var typeofUsing = typeof using;

		if (!into || !using) {
			//if one return value is undefined, use the one which is defined or return undefined
			return into || using;
		}
		if (typeofInto == typeofUsing) {
			//if the return values types are equal
			switch (typeofInto) {
			case "object":
				var isArrayInto = into instanceof Array;
				var isArrayUsing = using instanceof Array;
				if (isArrayInto == isArrayUsing && isArrayInto) {
					//if both are arrays, concatinate the results
					return into.concat(using);
				}
				//if both are objects, (shallow) merge them together
				return _.extend(into, using);
			case "string": case "number": 
				//if both a number or string, add the results to each other
				return into + using;
			}
		} else {
			//if the values have different types and both are defined, throw an error
			throw "Cannot merge different types";
		}
		
	}


	return Inherit;

});
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
define("extensions/adapt-editorial/js/lib/raf", function(){});

define('extensions/adapt-editorial/js/tiles/tile',[
    'coreJS/adapt',
    '../lib/Backbone.Inherit',
    '../lib/raf'
], function(Adapt) {

    //function for dividing up json settings and trimming white text
    var attributeSplitRegEx = /([\,]{1})|([^,]*\'.*\'[^,]*)|([^,]*\".*\"[^,]*)|([^,]*\(.*\)[^,]*)|([^,]*)/g;
    var trimRegEx = /^\s+|\s+$/g;
    function splitAttribute(attr) {
        var matches = attr.match(attributeSplitRegEx);
        var ret = [];
        var currentValue = "";
        for (var i = 0, l = matches.length; i < l; i++) {
            var match = matches[i];
            switch (match) {
            case ",":case "":
                ret.push(currentValue);
                currentValue = "";
                break;
            default:
                currentValue = match.replace(trimRegEx, '');
            }
        }
        return ret;
    }


    //tile unit
    var Tile = {

        //base tile view
        View: Backbone.View.extend({

            _isIE8: false,
            _isRemoved: false,
            _editorialArticleView: null,
            _hasReCheckedSize: true,

            classes: function() {
                return [
                    "tile",
                    "clearfix", 
                    this.model.get('_type'),
                    this.model.get('_id'),
                    this.model.get('_classes')
                ];
            },

            initialize: function(options) {
                this.$el.attr("class", _.uniq(this.classes()).join(" "));
                this.$el.attr("name", this.model.get("_id"));
                
                this._editorialArticleView = options.editorialArticleView;
                if (this.model.get("_editorialModel").get("_forceIE8")) this._isIE8 = true;
                this._parentView = options.parentView;

                this.setupEventListeners();

                this.setupHasText();
                
                this.onInitialize();
                
                this.preRender();
                this.render();

            },

            setupEventListeners: function() {

                this.listenTo(this._editorialArticleView, "resize", this.preResize);
                this.listenTo(this._parentView, "resize", this.preResize);
                this.listenToOnce(this._editorialArticleView, 'remove', this.onRemove);
                this.listenTo(this, "resize", this.preResize);

            },

            setupHasText: function() {
                var hasText = false;
                var model = this.model.toJSON();
                for (var k in model) {
                    if (k == "defaults") continue;
                    switch (k.slice(0,1)) {
                    case "_": case "@": case "#":
                        break;
                    default:
                        if (model[k]) hasText = true;
                        break;
                    }
                }

                this.model.set("_hasText", hasText);
            },

            onInitialize: function() {},

            preRender: function() {},

            render: function() {

                var data = this.model.toJSON();
                _.extend(data, { _globals: Adapt.course.get("_globals") });
                var template = Handlebars.templates[this.constructor.template];
                this.$el.html(template(data));

                _.defer(_.bind(function() {
                    // don't call postRender after remove
                    if(this._isRemoved) return;

                    this.postRender();

                }, this));

                return this;
            },

            postRender: function() {
                Adapt.trigger("tileView:postRender", this);
                this.checkReadyStatus();
            },

            checkReadyStatus: function() {
                this.setReadyStatus();
            },

            setReadyStatus: function() {
                this._editorialArticleView.trigger("tileView:ready");
            },

            preResize: function() {
                this.setupGridVariables();
                _.defer(_.bind(this.onResize, this));
            },

            onResize: function() {

                this.styleClear();

                var styleObject = this.getCalculatedStyleObject();
                this.renderStyle(styleObject);

            },

            setupGridVariables: function() {

                this.setupGridFixedVariables();
                this.setupGridRelativeVariables();

            },

            setupGridFixedVariables: function() {
                var config = this.model.toJSON();

                var rootKeys = _.filter(_.keys(config), function(key) {
                    if (key.slice(0,1) == "#") return true;
                });

                for (var vk = 0, vkl = rootKeys.length; vk < vkl; vk++) {
                    var key = rootKeys[vk];
                    var oKey = key;

                    if (key.slice(0,4) == "#ie8") continue;
                    if (this._isIE8) {
                        var ie8Key = "#ie8" + key.slice(1,2).toUpperCase() + key.slice(2);
                        if (config[ie8Key]) {
                            key = ie8Key;
                        }
                    }

                    var values = splitAttribute(config[key]);
                    var defaultValue;
                    if (config.defaults[oKey]) {
                        var defaultValues = splitAttribute(config.defaults[oKey]);
                        defaultValue = defaultValues[ config._editorialModel.get("_spanColumns") -1 ];
                    }

                    var value = values[ config._editorialModel.get("_spanColumns") -1 ];

                    if (value === undefined || value == "") {
                        value = defaultValue;
                    }
                    
                    this.$el.attr(oKey.slice(1), value);
                    var childContainer = this.$(".tile-container");
                    if (childContainer.length > 0) {
                        childContainer.attr(oKey.slice(1), value);
                    }
                    switch(value) {
                    case "no": case "false":
                        value = false;
                        break;
                    case "yes": case "true":
                        value = true;
                        break
                    }
                    
                    this.model.set("_"+oKey.slice(1), value);
                }
            },

            setupGridRelativeVariables: function() {
                var config = this.model.toJSON();

                var relativeKeys = _.filter(_.keys(config), function(key) {
                    if (key.slice(0,1) == "@") return true;
                });

                for (var vk = 0, vkl = relativeKeys.length; vk < vkl; vk++) {
                    var key = relativeKeys[vk];
                    var oKey = key;
                    
                    if (key.slice(0,4) == "@ie8") continue;
                    if (this._isIE8) {
                        var ie8Key = "@ie8" + key.slice(1,2).toUpperCase() + key.slice(2);
                        if (config[ie8Key]) {
                            key = ie8Key;
                        }
                    }

                    var values = splitAttribute(config[key]);
                    var defaultValue;
                    if (config.defaults[oKey]) {
                        var defaultValues = splitAttribute(config.defaults[oKey]);
                        defaultValue = defaultValues[ config._editorialModel.get("_spanColumns") -1 ];
                    }

                    var value = values[ config._parentModel.get("_spanColumns") - 1 ];
                    
                    if (value === undefined || value == "") {
                        value = defaultValue;
                    }

                    this.$el.attr(oKey.slice(1), value);
                    var $childContainer = this.$el.find("> .tile-container");
                    if ($childContainer.length > 0) {
                        $childContainer.attr(oKey.slice(1), value);
                    }
                    switch(value) {
                    case "no": case "false":
                        value = false;
                        break;
                    case "yes": case "true":
                        value = true;
                        break
                    }
                    this.model.set("_"+oKey.slice(1), value);
                    
                }
            },

            styleClear: function() {
                this.renderStyle({});
            },

            getCalculatedStyleObject: function() {
                var styleObject = this.model.toJSON();

                var $childContainer = this.$el.find("> .tile-container");

                //tile height/width ratio
                if (!this._internalResize) {
                    this.$el.css("height", "");
                    this.$el.css("min-height", "");
                    if ($childContainer.length > 0) {
                        $childContainer.css("height","");
                        $childContainer.css("min-height","");
                    }
                    if (styleObject['_ratio']) {
                    
                        styleObject._tileHeight = this.$el.width() * styleObject['_ratio'];
                        
                    } else if (styleObject['_fillHeight']) {
                        _.defer(_.bind(function() {
                            var $parent = this.$el.parent();
                            var parentHeight = $parent.height();
                            if (this.$el.height() < parentHeight) {
                                styleObject._tileHeight = parentHeight;
                                this.$el.css("height", parentHeight);
                                this.$el.css("min-height", parentHeight);
                                if ($childContainer.length > 0) {
                                    $childContainer.css("height",parentHeight);
                                    $childContainer.css("min-height",parentHeight);
                                }
                                this._internalResize = true;
                                this.trigger("resize");
                            }
                        }, this));

                    }
                } else this._internalResize = false;

                if (styleObject['_spanColumns'] == styleObject._parentModel.get("_spanColumns") ) {
                    styleObject._fullWidth = true;
                } else {
                    styleObject._fullWidth = false;
                }

                return styleObject;
                
            },

            renderStyle: function(styleObject) {

                var tileHeight = styleObject._tileHeight ? styleObject._tileHeight : "";
                var tileVerticalAlign = styleObject._verticalAlign || ""
                var tileBackground = styleObject._background || ""
                this.$el.css({
                    "height": tileHeight, 
                    "vertical-align": tileVerticalAlign,
                    "background": tileBackground
                });

                if (styleObject._fullWidth) {
                    this.$el.attr("fullWidth", true);
                } else {
                    this.$el.removeAttr("fullWidth");
                }
                
            },

            onRemove: function() {
                 this.resetViewState();
                 this.remove();
            },

            resetViewState: function() {
                this._isRemoved = true;
                this._editorialArticleView = null;
            }

        }),

        //base tile model
        Model: Backbone.Model.extend({

            defaults: function() {
                return {
                    "@spanColumns": "1,2,3,4",
                    "#ratio": ",,,",
                    "#fillHeight": "false,false,false,false"
                };
            },

            initialize: function() {

                this.set("_globals", Adapt.course.get("_globals"));

                var config = this.toJSON();
                this.set("defaults", this.defaults());

                var fixedKeys = _.filter(_.keys(config), function(key) {
                    if (key.slice(0,1) == "_") return true;
                });

                for (var vk = 0, vkl = fixedKeys.length; vk < vkl; vk++) {
                    var key = fixedKeys[vk];

                    if (key.slice(0,4) == "_ie8") continue;
                    if (this._isIE8) {
                        var ie8Key = "_ie8" + key.slice(1,2).toUpperCase() + key.slice(2);
                        if (config[ie8Key]) {
                            this.set(key, config[ie8Key]);
                        }
                    }

                    
                }

            }

        }),


        //tile registry

        _tileStore: {},
    
        register: function(name, object) {
            if (Tile._tileStore[name])
                throw Error('This component already exists in your project');
            if (!object.View) object.View =  Tile.View.extend({});
            if (!object.Model) object.Model =  Tile.Model.extend({});
            object.View.template = "e-"+name;
            Tile._tileStore[name] = object;
        },
    
        get: function(name) {
            return Tile._tileStore[name];
        },

        //unit extention function

        extend: function(to) {
            return _.extend({}, Tile, to);
        }

    };

    return Tile;

});

define('extensions/adapt-editorial/js/adapt-editorialArticleView',[
    'coreJS/adapt',
    'coreViews/articleView',
    './tiles/tile',
], function(Adapt, ArticleView, Tile) {

    var EditorialView = {

        _tilesReady: 0,
        _primaryTilePixelWidth: 0,
        _editorialModel: null,
        
        render: function() {
            ArticleView.prototype.render.call(this);
            if (this.model.isEditorialEnabled && this.model.isEditorialEnabled()) {
                this._editorialModel = this.model.get("_editorialModel");
                if (this._editorialModel.get("_forceIE8")) this.$el.addClass("ie8");
                this.$el.addClass(this._editorialModel.get("_classes"));
                this.$(".block-container").removeClass("block-container");
                this.$el.append( $(Handlebars.templates['adapt-editorialArticleView'](this.model.toJSON())) );

            }
        },

        postRender: function() {
            ArticleView.prototype.postRender.call(this);
            if (this.model.isEditorialEnabled()) {
                this.setupEditorialEventListeners();
                this.addEditorialChildren();
            }
        },

        setupEditorialEventListeners: function() {
            this.listenToOnce(Adapt, "remove", this.onRemoveEditorial);
            this.listenTo(Adapt, "device:resize", this.onResizeEditorial);
            this.listenTo(Adapt, "device:change", this.onResizeEditorial);
            this.on("tileView:ready", this.onEditorialTileReady);
        },

        addEditorialChildren: function() {
            var editorialModel = this.model.get("_editorialModel");

            var $tilesById = {};
            var $tileContainersById = {};
            var groupViews = {};

            //create group tiles in cascade order
            //this is so that the resize event triggers the resize of groups in cascade order

            var groupModels = editorialModel.get("_groupModels");
            var GroupInstantiator = Tile.get("group");
            for (var groupModel, i = 0; groupModel = groupModels.models[i++];) {
                var groupId = groupModel.get("_id");
                var groupParentId = groupModel.get("_parentId");
                var groupView = new GroupInstantiator.View({ model: groupModel, editorialArticleView: this });

                groupViews[groupId] = groupView;
                $tilesById[groupId] =  groupView.$el;
                $tileContainersById[groupId] = groupView.$(".tile-container");

            }

            //create non-group tiles
            var contentModels = editorialModel.get("_contentModels");
            for (var tileModel, i = 0; tileModel = contentModels.models[i++];) {
                var tileId = tileModel.get("_id");
                var tileType = tileModel.get("_type");
                var TileInstantiator = Tile.get(tileType);
                var tileParentId = tileModel.get("_parentId");
                var tileView;
                if (tileParentId) {
                    tileView = new TileInstantiator.View({ model: tileModel, editorialArticleView: this, parentView:  groupViews[tileParentId]});
                } else {
                    tileView = new TileInstantiator.View({ model: tileModel, editorialArticleView: this, parentView: undefined });
                }

                $tilesById[tileId] =  tileView.$el;
            }

            //add new elements to dom in tile order
            var $primaryTile = this.$('.tile-container.primary');
            var tileModels = editorialModel.get("_tileModels");
            for (var tileModel, i = 0; tileModel = tileModels.models[i++];) {
                var tileId = tileModel.get("_id");
                var tileParentId = tileModel.get("_parentId");
                var $element = $tilesById[tileId];

                if (tileParentId) {
                    $tileContainersById[tileParentId].append( $element  );
                } else {
                    $primaryTile.append( $element );
                }
            }

        },

        onEditorialTileReady: function() {
            var tilesModels = this._editorialModel.get("_tileModels");

            this._tilesReady++;

            var hasFinishedLoading = this._tilesReady >= tilesModels.models.length;

            if (hasFinishedLoading) this.onEditorialArticleReady();
        },

        onEditorialArticleReady: function() {
            this.off("tileView:ready", this.onEditorialTileReady);
            this.model.set("_isEditorialReady", true);
            this.model.checkReadyStatus();
            this.onResizeEditorial();
        },

        onResizeEditorial: function() {
            if (!this.model.get("_isEditorialReady")) return;
            
            window.requestAnimationFrame(_.bind(function() {

                if (!this.setupEditorialPrimaryTileColumnWidth()) return;


                var style = this.$("style").remove(); //ios fix - remove and readd the styling
                this.$el.append(style); //ios fix

                this.trigger("resize");

                _.defer(_.bind(function() {
                    this.$(".editorial-container").css({
                        "visibility": ""
                    }); //ie8 hide until finished fix
                }, this));

            }, this));
        },

        setupEditorialPrimaryTileColumnWidth: function() {

            var screenSize = Adapt.config.get("screenSize");
            var maxColumns = this._editorialModel.get("_maxColumns");
            var maxColumnWidth = this._editorialModel.get("_maxColumnWidth");


            var columnMaxPixelWidth = maxColumnWidth ? maxColumnWidth : Math.floor(screenSize.large / maxColumns);

            var $primaryTile = this.$('.tile-container.primary');
            var primaryTilePixelWidth = $primaryTile.outerWidth();

            if (this._primaryTilePixelWidth == primaryTilePixelWidth) return false;
            this._primaryTilePixelWidth = primaryTilePixelWidth;

            //calculate primary tile grid column size
            var primaryTileColumnWidth = Math.floor(primaryTilePixelWidth / columnMaxPixelWidth) || 1;
            
            if (primaryTileColumnWidth > maxColumns) primaryTileColumnWidth = maxColumns; 


            $primaryTile.attr("spanColumns", primaryTileColumnWidth);
            this._editorialModel.set("_spanColumns", primaryTileColumnWidth);

            return true;
        },


        onRemoveEditorial: function() {
            this.removeEditorialEventListeners();
            this.model.set("_isEditorialReady", false);
            this.trigger("remove");
        },

        removeEditorialEventListeners: function() {
            this.stopListening(Adapt, "device:resize", this.onResizeEditorial);
            this.off("tileView:ready", this.onEditorialTileReady);
        }

    };

    return EditorialView;

});
define('extensions/adapt-editorial/js/adapt-editorialArticleModel',[
    'coreModels/articleModel',
    './tiles/tile'
], function(ArticleModel, Tile) {

    var EditorialModel = {

        postInitialize: function() {
            if (!this.isEditorialEnabled()) return;
            this.set("_isEditorialReady", false);
            this.setupEditorial();
            this.setupEditorialGridRules();
            this.setupEditorialChildren();
        },

        isEditorialEnabled: function() {
            var config = this.getEditorialConfig();
            return config && config._isEnabled;
        },

        setupEditorial: function() {
            var config = this.getEditorialConfig();
            _.extend(config, { _id: this.get("_id") });
            this.set("_editorialModel", new Backbone.Model(config));

        },

        setupEditorialGridRules: function() {
            var editorialModel = this.get("_editorialModel");
            var maxColumns = editorialModel.get("_maxColumns");

            var rules = [];
            for (var i = 0, l = maxColumns; i < l; i++) {
                for (var r = 0, rl = i + 2; r < rl; r++) {
                    var columnWidth = i + 1;
                    rules.push({
                        "_columnWidth": columnWidth,
                        "_spanColumns": r,
                        "_displayNone": r == 0 ? true : false,
                        "_width": Math.floor((r / columnWidth) * 10000) / 100
                    });
                }
            }

            editorialModel.set("_columnStyleRules", rules);
        },

        setupEditorialChildren: function() {
            var articleId = this.get("_id");
            var editorialModel = this.get("_editorialModel");

            var tiles = editorialModel.get("_tiles");

            var indexedTiles = _.indexBy(tiles, "_id");

            var groups = this.getEditorialGroupCascadeOrder();
            var groupModelsIndexed = {};
            var tileModelsIndexed = {};

            var GroupInstantiator = Tile.get("group");
            for (var group, i = 0; group = groups[i++];) {

                group._editorialId = articleId;
                group._editorialModel = editorialModel;

                if (group._parentId) {
                    group._parentModel = groupModelsIndexed[group._parentId];
                } else {
                    group._parentModel = editorialModel;
                }

                var groupModel = new GroupInstantiator.Model(group);
                groupModelsIndexed[group._id] = groupModel;
            }

            editorialModel.set("_groupModels", new Backbone.Collection(_.values(groupModelsIndexed)));
            
            var contentTiles = _.filter(tiles, function(tile) { return tile._type != "group" });
            var contentTilesIndexed = {};
            for (var tile, i = 0; tile = contentTiles[i++];) {
                tile._editorialId = articleId;
                tile._editorialModel = editorialModel;

                var TileInstantiator = Tile.get(tile._type);

                if (tile._parentId) {
                    tile._parentModel = groupModelsIndexed[tile._parentId];
                } else {
                    tile._parentModel = editorialModel;
                }

                var tileModel = new TileInstantiator.Model(tile);

                contentTilesIndexed[tile._id] = tileModel;
            }

            for (var tile, i = 0; tile = tiles[i++];) {
                tileModelsIndexed[tile._id] = groupModelsIndexed[tile._id] || contentTilesIndexed[tile._id];
            }


            editorialModel.set("_contentModels", new Backbone.Collection(_.values(contentTilesIndexed)));
            editorialModel.set("_tileModels", new Backbone.Collection(_.values(tileModelsIndexed)));
        },

        getEditorialConfig: function() {
            return this.get("_editorial");
        },

        checkReadyStatus: function(model, val) {
            if (!this.isEditorialEnabled()) ArticleModel.prototype.checkReadyStatus.call(this);
            if (!this.get("_isEditorialReady")) return;

            var availableChildren = new Backbone.Collection(this.findDescendants('components').where({_isAvailable: true, _isOptional:false}));
            var notReadyChildren = availableChildren.where({_isReady: false});
            var hasNotReadyChildren = notReadyChildren.length > 0;

            var notReadyIds = [];
            _.each(notReadyChildren, function(item){
                notReadyIds.push(item.get("_id"));
            });
            //console.log(notReadyIds.join(","))

            if (hasNotReadyChildren) return;

            this.set("_isReady", true);
        },

        getEditorialGroupCascadeOrder: function() {
            //sort groups by descendent levels

            var groupCascadeOrder = [];

            var editorialModel = this.get("_editorialModel");
            var tiles = editorialModel.get("_tiles");

            var groups = _.where(tiles, { _type: "group" });
            var groupIndex = _.indexBy(groups, "_id");
            var rootGroups = _.filter(groups, function(group) {
                return !group._parentId;
            });

            var resolve = rootGroups;
            removeResolveFromGroups();

            var tick = 0;
            //stop if no more in groups array and not move in resolve array or stack overrun.
            while ((groups.length > 0 || resolve.length > 0) && tick < 100) {

                //add all resolve elements to cascade order
                for (var r = 0, rl = resolve.length; r < rl; r++) {
                    var resItem = resolve[r];
                    groupCascadeOrder.push(resItem);
                }

                //get resolve elements children and put in resolve
                resolveNextChildren();

                //remove resolve elements from groups array
                removeResolveFromGroups();

                tick++;
            }

            return groupCascadeOrder;

            function removeResolveFromGroups() {
                groups = _.filter(groups, function(group) {
                    //if the resolve item found in groups list, remove it from groups list
                    return _.findWhere(resolve, {_id: group._id}) === undefined;
                });
            }

            function resolveNextChildren() {
                resolve = _.filter(groups, function(group) {
                    //if the group is child of a resolve item, add it to next resolve list
                    return _.findWhere(resolve, { _id: group._parentId}) !== undefined; 
                });
            }
        }
        
    };

    return EditorialModel;
});

define('extensions/adapt-editorial/js/tiles/e-group',[
    './tile'
], function(Tile) {

    var GroupTile = {};

    Tile.register('group', GroupTile);

    return GroupTile;

});

//https://github.com/cgkineo/jquery.resize 2015-08-13

(function() {

  if ($.fn.off.elementResizeOriginalOff) return;


  var orig = $.fn.on;
  $.fn.on = function () {
    if (arguments[0] !== "resize") return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));

    addResizeListener.call(this, (new Date()).getTime());

    return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
  };
  $.fn.on.elementResizeOriginalOn = orig;
  var orig = $.fn.off;
  $.fn.off = function () {
    if (arguments[0] !== "resize") return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));

    removeResizeListener.call(this, (new Date()).getTime());

    return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
  };
  $.fn.off.elementResizeOriginalOff = orig;

  var expando = $.expando;

  //element + event handler storage
  var resizeObjs = {};

  //jQuery element + event handler attachment / removal
  var addResizeListener = function(data) {
      resizeObjs[data.guid + "-" + this[expando]] = { 
        data: data, 
        $element: $(this) 
      };
  };

  var removeResizeListener = function(data) {
    try { 
      delete resizeObjs[data.guid + "-" + this[expando]]; 
    } catch(e) {

    }
  };

  function checkLoopExpired() {
    if ((new Date()).getTime() - loopData.lastEvent > 500) {
      stopLoop()
      return true;
    }
  }

  function resizeLoop () {
    if (checkLoopExpired()) return;

    var resizeHandlers = getEventHandlers("resize");

    if (resizeHandlers.length === 0) {
      //nothing to resize
      stopLoop();
      resizeIntervalDuration = 500;
      repeatLoop();
    } else {
      //something to resize
      stopLoop();
      resizeIntervalDuration = 250;
      repeatLoop();
    }

    if  (resizeHandlers.length > 0) {
      var items = resizeHandlers;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        triggerResize(item);
      }
    }

  }

  function getEventHandlers(eventName) {
    var items = [];
    
    switch (eventName) {
    case "resize":
      for (var k in resizeObjs) {
        items.push(resizeObjs[k]);
      }
      break;
    }

    return items;
  }

  function getDimensions($element) {
      var height = $element.outerHeight();
      var width = $element.outerWidth();

      return {
        uniqueMeasurementId: height+","+width
      };
  }

  function triggerResize(item) {
    var measure = getDimensions(item.$element);
    //check if measure has the same values as last
    if (item._resizeData !== undefined && item._resizeData === measure.uniqueMeasurementId) return;
    item._resizeData = measure.uniqueMeasurementId;
    
    //make sure to keep listening until no more resize changes are found
    loopData.lastEvent = (new Date()).getTime();
    
    item.$element.trigger('resize');
  }


  //checking loop interval duration
  var resizeIntervalDuration = 250;

  var loopData = {
    lastEvent: 0,
    interval: null
  };

  //checking loop start and end
  function startLoop() {
    loopData.lastEvent = (new Date()).getTime();
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function repeatLoop() {
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function stopLoop() {
    clearInterval(loopData.interval);
    loopData.interval = null;
  }

  $('body').on("mousedown mouseup keyup keydown", startLoop);
  $(window).on("resize", startLoop);


})();

define("extensions/adapt-editorial/js/lib/jquery.resize", function(){});

//https://github.com/cgkineo/jquery.backgroundImage 2015-08-18

;(function( $ ) {

    if ($.fn.backgroundImage) return;

    $.fn.backgroundImage = function(options) {

        options = options || {};
        if (options.dynamicRatio === undefined) options.dynamicRatio = false;
        if (options.expandContainerHeight === undefined) options.expandContainerHeight = true;
        if (options.expandHeight === undefined) options.expandHeight = undefined;
        if (options.selector === undefined) options.selector = "img";
        if (options.restrict === undefined) options.restrict = "auto auto";

        var $images = this.find(options.selector).add( this.filter(options.selector) );

        if ($images.length === 0) return;

        $images.each(function() {
            process($(this), options);
        });

    };

    function process($image, options) {
        var $offset = $image.parent();
        var $container = $offset.parent();
        var $containerParent = $container.parent();
        
        //reset image and offset
        $offset.css({
            "height": "",
            "width": "",
            "overflow": "hidden",
            "max-width": "100%",
            "max-height": "100%"
        });
        $image.css({
            "top": "",
            "left": "",
            "bottom": "",
            "right": "",
            "width": "",
            "height": "",
            "max-width": "100%",
            "max-height": "100%"
        });

        var imageDim = $image.getDimensions(options.dynamicRatio);

        //set/unset container height if required
        if (options.expandContainerHeight === true) {
            $container.css({
                "height": "100%"
            });
            if ($containerParent.height() > 0) {
                $container.css({
                    "height": $containerParent.height() + "px"
                });
            }
        } else if (options.expandContainerHeight === false) {
            $container.css({
                "height": ""
            });
        }

        var containerDim = $container.getDimensions(true);


        // set offset container to fill the width
        var offsetDimensions = {
            "width": "100%"
        };        
        
        /* only fill the height if asked in the settings or if the container height is larger than the offset height, 
        *  otherwise where content height is generated from the conent image, 
        *  100% height is meaningless before the image is in
        */
        if (containerDim.height > $offset.height() && offsetDimensions.height === undefined && options.expandHeight === undefined) {
            options.expandHeight = true;
            offsetDimensions.height = containerDim.height + "px";
        }
        //set offset style
        $offset.css(offsetDimensions);

        //capture body and container fontsize for rem and em calculations
        containerDim['fontSize'] = $container.css("font-size");
        var documentFontSize = $("body").css("font-size");
        
        //setup image for styling
        var imageDimensions = {
            "max-width": "none",
            "max-height": "none"
        };


        /* check the position variable to set the top left position of the image 
        *  inside it's overall container
        */
        var positionsDim;
        if (options.position !== undefined) {

            //setup image position styles for filling
            $.extend(imageDimensions, {
                "top": "",
                "left": "",
                "bottom": "",
                "right": ""
            });

            var positions = (options.position || "top left").split(" ");

            positionsDim = convertPositions(containerDim, imageDim, {
                "left": positions[0], 
                "top": positions[1], 
                "documentFontSize": documentFontSize
            });
            imageDimensions.top = positionsDim.top;
            imageDimensions.left = positionsDim.left;

        }

        //setup image size styles for filling
        if (options.size !== undefined) {
            $.extend(imageDimensions, {
                "width": "",
                "height": ""
            });
        }

        //setup image size (height / width);
        switch (options.size) {
        case undefined:
        case "contain":
            //default to contain if size is undefined, auto auto, or contain
            if (containerDim.ratio < imageDim.ratio) {
                var width = containerDim.width;
                imageDimensions.width = width + "px";
                imageDimensions.height = width / imageDim.ratio + "px"
            } else {
                var height = containerDim.height;
                imageDimensions.height = height + "px";
                imageDimensions.width = height * imageDim.ratio + "px"
            }
            break;

        case "cover":

            if (containerDim.ratio > imageDim.ratio) {
                var width = containerDim.width;
                imageDimensions.width = width + "px";
                imageDimensions.height = width / imageDim.ratio + "px"
            } else {
                var height = containerDim.height;
                imageDimensions.height = height + "px";
                imageDimensions.width = height * imageDim.ratio + "px"
            }
            break;

        default:
            //setup image value styles
            var sizes = (options.size || "100% auto").split(" ");
            var widthSize = sizes[0];
            var heightSize = sizes[1];

            var dims = convertDimensions(containerDim, imageDim, {
                "width": widthSize, 
                "height": heightSize,
                "documentFontSize": documentFontSize
            });

            imageDimensions.height = dims.height;
            imageDimensions.width = dims.width;

        }

        //correct any leftover styles with the image height/width if required
        if (imageDimensions.height === "auto") {
            imageDimensions.height = imageDim.height;
        }

        if (imageDimensions.width === "auto") {
            imageDimensions.width = imageDim.width;
        }

        //restrict the offset container (height/width) if required
        if (options.restrict !== undefined) {
            var restricts = options.restrict.split(" ");
            
            imageDimensions.ratio = imageDim.ratio;

            var dims = convertRestricts(containerDim, imageDimensions, {
                "width": restricts[0], 
                "height": restricts[1], 
                "documentFontSize": documentFontSize
            });

            offsetDimensions.width = dims.width;
            offsetDimensions.height = dims.height;

            $offset.css(offsetDimensions);
        }
        

        var offsetDim = $offset.getDimensions(true);

        //center, bottom or right align the image inside the offset container
        if (imageDimensions.top === "center") {
            var height = imageDimensions.height === undefined ? imageDim.height : parseInt(imageDimensions.height);
            imageDimensions.top = ((offsetDim.height / 2) - (parseFloat(height) / 2)) + "px";
        } else if (imageDimensions.top === "bottom") {
            var height = imageDimensions.height === undefined ? imageDim.height : parseInt(imageDimensions.height);
            imageDimensions.top = ((offsetDim.height) - (parseFloat(height))) + "px";
        }
        if (imageDimensions.left === "center") {
            var width = imageDimensions.width === undefined ? imageDim.width : parseFloat(imageDimensions.width);
            imageDimensions.left = ((offsetDim.width / 2) - (parseFloat(width) / 2)) + "px";
        } else if (imageDimensions.left === "right") {
            var width = imageDimensions.width === undefined ? imageDim.width : parseFloat(imageDimensions.width);
            imageDimensions.left = ((offsetDim.width) - (parseFloat(width))) + "px";
        }

        //apply the style
        $image.css(imageDimensions);
    }

    function arrayIndexOf(arr, value) {
        if (arr.indexOf) return arr.indexOf(value);
        for (var i = 0, l = arr.length; i < l; i++) {
            if (arr[i] == value) return i;
        }
        return -1;
    }

    function convertDimensions(container, image, settings) {
        var dim = {
            "width": 0,
            "height": 0
        };
        if (settings.width === undefined) settings.width = "auto";
        if (settings.height === undefined) settings.height = "auto";

        dim.width = convertDimension(container.width, settings.width, container.fontSize, settings.documentFontSize);
        dim.height = convertDimension(container.height, settings.height, container.fontSize, settings.documentFontSize);

        var autos = {
            "width": isAuto(dim.width),
            "height": isAuto(dim.height)
        };

        if (autos.width && autos.height) {
            if (container.ratio < image.ratio) {
                dim.width = container.width + "px";
                dim.height = (container.width / image.ratio) + "px"
            } else {
                dim.height = container.height + "px";
                dim.width = (container.height * image.ratio) + "px";
            }
        } else if (autos.width) {
            dim.width = (parseFloat(dim.height) * image.ratio) + "px";
        } else if (autos.height) {
            dim.height = (parseFloat(dim.width) / image.ratio) + "px";
        }

        return dim;

    }

    function convertDimension(containerValue, settingsValue, containerFontSize, documentFontSize) {
        if (isAuto(settingsValue)) {
            return "auto";
        } else if (isPercent(settingsValue)) {
            var val = parseFloat(settingsValue);
            return ((containerValue / 100) * val) + "px";
        } else if (isPixel(settingsValue)) {
            return parseFloat(settingsValue) + "px";
        } else if (isREM(settingsValue)) {
            return (documentFontSize * parseFloat(settingsValue)) + "px";
        } else if (isEM(settingsValue)) {
            return (containerFontSize * parseFloat(settingsValue)) + "px";
        }
        return "auto";
    }

    function convertPositions(container, image, settings) {
        var dim = {
            "left": 0,
            "top": 0
        };
        if (settings.left === undefined) settings.left = "left";
        if (settings.top === undefined) settings.top = "top";

        var swapped = false;
        switch (settings.left) {
        case "top": case "bottom":
            var a = settings.top;
            settings.top = settings.left;
            settings.left = a;
            swapped = true;
        }

        switch (settings.top) {
        case "left": case "right":
            if (!swapped) {
                var a = settings.top;
                settings.top = settings.left;
                settings.left = a;
                swapped = true;
            } else {
                settings.top = "top";
            }
        }

        dim.left = convertPosition(container.width, settings.left, container.fontSize, settings.documentFontSize);
        dim.top = convertPosition(container.height, settings.top, container.fontSize, settings.documentFontSize);

        if (dim.left === "auto") dim.left = "0px";
        if (dim.top === "auto") dim.top = "0px";

        return dim;
    }

    function convertPosition(containerValue, settingsValue, containerFontSize, documentFontSize) {
        if (isAuto(settingsValue)) {
            return "auto";
        } else if (isPercent(settingsValue)) {
            var val = parseFloat(settingsValue);
            return ((containerValue / 100) * val) + "px";
        } else if (isPixel(settingsValue)) {
            return parseFloat(settingsValue) + "px";
        } else if (isREM(settingsValue)) {
            return (documentFontSize * parseFloat(settingsValue)) + "px";
        } else if (isEM(settingsValue)) {
            return (containerFontSize * parseFloat(settingsValue)) + "px";
        }
        switch(settingsValue) {
        case "center":
            return "center";
        case "top":
            return "0px"
        case "left":
            return "0px"
        case "bottom":
            return "bottom";
        case "right":
            return "right";
        }
        return "auto";
    }

    function convertRestricts(container, image, settings) {
        var dim = {
            "width": 0,
            "height": 0
        };
        if (settings.width === undefined) settings.width = "auto";
        if (settings.height === undefined) settings.height = "auto";

        dim.width = convertDimension(container.width, settings.width, container.fontSize, settings.documentFontSize);
        dim.height = convertDimension(container.height, settings.height, container.fontSize, settings.documentFontSize);

        var autos = {
            "width": isAuto(dim.width),
            "height": isAuto(dim.height)
        };

        if (autos.width && autos.height) {
            dim.height = parseFloat(image.height) + "px";
            dim.width =  parseFloat(image.width) + "px";
        } else if (autos.width) {
            dim.width = parseFloat(image.width) + "px";
        } else if (autos.height) {
            dim.height = parseFloat(image.height) + "px";
        }

        return dim;

    }

    function isAuto(value) {
        return (/(auto){1}/gi).test(value);
    }

    function isRelative(value) {
        return (/^(\+|\-){1}/g).text(value);
    }

    function isPercent(value) {
        return (/\%{1}/g).test(value);
    }

    function isPixel(value) {
        return (/(px){1}/gi).test(value);
    }

    function isREM(value) {
        return (/(rem){1}/gi).test(value);
    }

    function isEM(value) {
        return (/(em){1}/gi).test(value);
    }
  

})( jQuery );

define("extensions/adapt-editorial/js/lib/jquery.backgroundimage", function(){});

define('extensions/adapt-editorial/js/tiles/lightbox',[
    'coreJS/adapt',
    '../tiles/tile',
    '../lib/jquery.resize',
    '../lib/jquery.backgroundimage'
], function(Adapt, Tile) {

    var LightboxTile = Tile.extend({
        View: Tile.View.extend({

            _disableAnimations: false,
            _lightboxOpen: false,
            _lightboxId: "",
            _lightboxBackground: false,
            _lightboxFullsize: false,
            _lightboxHasSized: false,
            _lightboxCurrentOffsetTop: 0,
            _lightboxCurrentAvailableHeight: 0,
            _animationDuration: 400,
            _windowDimensions: null,
            _forceResize: true,
            _iOS: /iPad|iPhone|iPod/.test(navigator.platform),

            onInitialize: Backbone.ascend("onInitialize", function() {
                var linkId = this.model.get("_linkId");
                if (!linkId) return;

                if (this._isIE8 || $('html').is(".ie8") || $('html').is(".iPhone.version-7\\.0")) {
                    this._disableAnimations = true;
                }

                if (linkId.indexOf("/") === -1) {
                    this.$el.addClass(linkId);
                } else {
                    this.$el.addClass("incomplete");
                }
                this.$el.attr("data-link", linkId);
            }),

            postRender: Backbone.ascend("postRender", function() {
                var linkId = this.model.get("_linkId");
                if (!linkId) return;

                this.onLinkClick = _.bind(this.onLinkClick, this);
                this.onCloseClick = _.bind(this.onCloseClick, this);

                this.$("button[data-link]").on("click", this.onLinkClick);
                
                switch (this.model.get("_type")) {
                case "video":
                    this.$(".text").on("click", this.onLinkClick);
                    break;
                case "text":
                case "image":
                    this.$el.on("click", this.onLinkClick);
                    break;
                }

                this.listenTo(Adapt, "lightbox:did-hide", this.onCloseClick);

                this.updateProgressBars();

            }),

            onLinkClick: function(event) {
                event.preventDefault();
                if (this._lightboxOpen) return;

                var linkId = this.model.get("_linkId");

                if (linkId.indexOf("/") > -1) {
                    window.open(linkId, "lightbox_resource");
                    this.$el.addClass("complete").removeClass("incomplete");
                    return;
                }

                $('video,audio').trigger('pause');

                this._lightboxOpen = true;

                Adapt.trigger("lightbox:show", linkId);

                var visitedLink = this.model.get('_linkTextVisited');
                this.$('.lightbox-link-progress').html(visitedLink).attr('aria-label', visitedLink);
            },

            onCloseClick: function(event) {
                if (!this._lightboxOpen) return;

                this.updateProgressBars();

                $('video,audio').trigger('pause');
                
                this._lightboxOpen = false;
                

            },

            updateProgressBars: function() {
                var linkId = this.model.get("_linkId");
                if (!linkId) return;

                if (linkId.indexOf("/") > -1) return;


                var linkModel = Adapt.findById(linkId);
                var componentModels = linkModel.findDescendants("components");
                componentModels = new Backbone.Collection(componentModels.where({
                    "_isAvailable": true
                }));

                var completeComponents = new Backbone.Collection(componentModels.where({
                    _isComplete: true
                }));

                var percentageComplete = 100;
                if (componentModels.length > 0) {
                    percentageComplete = (completeComponents.length / componentModels.length ) * 100;
                }

                if (percentageComplete == 0) {
                    this._editorialArticleView.$("[data-link='"+linkId+"']").removeClass("complete").addClass('incomplete');
                } else if (percentageComplete > 0 && percentageComplete < 100) {
                    this.$('.lightbox-link-progress').html(visitedLink).attr('aria-label', visitedLink);
                } else if (percentageComplete == 100) {
                    this._editorialArticleView.$("[data-link='"+linkId+"']").removeClass("incomplete partially-complete").addClass('complete visited');
                    var completedLink = this.model.get('_linkTextComplete');
                    this.$('.lightbox-link-progress').html(completedLink).attr('aria-label', completedLink);
                }


                this._editorialArticleView.$("[data-link='"+linkId+"']").addClass()

                this._editorialArticleView.$("[data-link='"+linkId+"'] .lightbox-link-progress-bar").css({
                    "width": percentageComplete +"%"
                });

                if (Adapt.course.get("_globals") && Adapt.course.get("_globals")._extensions && Adapt.course.get("_globals")._extensions._editorial) {
                    var ariaLabel = Adapt.course.get("_globals")._extensions._editorial.progressIndicatorBar;
                    var ariaLabelInstructions = Adapt.course.get("_globals")._extensions._editorial.progressIndicatorBarIncompleteInstructions;
                    var $ariaLabel = this._editorialArticleView.$("[data-link='"+linkId+"'] .lightbox-link-progress-bar .aria-label");
                    $ariaLabel.html(ariaLabel + " " + percentageComplete + "%. " + (percentageComplete == 100 ? "" : ariaLabelInstructions));
                }
            },

            getCalculatedStyleObject: Backbone.ascend("getCalculatedStyleObject", function(styleObject) {
                var styleObject = this.model.toJSON();
                
                var linkId = this.model.get("_linkId");
                if (!linkId) return;
                
                switch (styleObject._linkStyle) {
                case "title":
                    this.$(".lightbox-link-title").removeClass("display-none")
                    this.$(".lightbox-link-center").addClass("display-none");
                    break;
                case "center":
                    this.$(".lightbox-link-title").addClass("display-none")
                    this.$(".lightbox-link-center").removeClass("display-none");
                    break;
                }
            }),

            onRemove: Backbone.descend("onRemove", function() {
                var linkId = this.model.get("_linkId");
                if (!linkId) return;
                
                this.stopListening(Adapt, "lightbox:close", this.onCloseClick);

                this.$("button[data-link]").off("click", this.onLinkClick);
                this.$(".text").off("click", this.onLinkClick);
                delete this.onLinkClick;
            })

        }),

        Model: Tile.Model.extend({

            defaults: Backbone.ascend("defaults", function() {
                return {
                    "_linkId": null,
                    "_linkText": null,
                    "_linkInstruction": null,
                    "_linkStyle": null,
                    
                };
            })

        })

    });

    return LightboxTile;

});


define('extensions/adapt-editorial/js/tiles/e-text',[
    './tile',
    './lightbox'
], function(Tile, LightboxTile) {

    var TextTile = Tile.extend({

    	View: LightboxTile.View.extend({

            classes: Backbone.ascend("classes", function() {
                return [
                    "content"
                ];
            }),

            renderStyle: Backbone.descend("renderStyle", function(styleObject) {

                var textRoundedCorderColor = styleObject._textRoundedCornerColor || "";
                 this.$(".text").css({ 
                    "background-color": textRoundedCorderColor
                });

                var textBackgroundColor = styleObject._textBackgroundColor || "";
                this.$(".text .background").css({ 
                    "background-color": textBackgroundColor
                });

                var textTitleColor = styleObject._textTitleColor || "";
                this.$(".text .title").css({ 
                    "color": textTitleColor
                });

                var textTitleFontSize = styleObject._textTitleFontSize || "";
                this.$(".text .title").css({ 
                    "font-size": textTitleFontSize
                });

                var textBodyColor = styleObject._textBodyColor || "";
                this.$(".text .body").css({ 
                    "color": textBodyColor
                });

                var textInstructionColor = styleObject._textInstructionColor || "";
                this.$(".text .instruction").css({ 
                    "color": textInstructionColor
                });

                var textHeight = "";
                if (!textHeight && styleObject._fillHeight) {
                    var contentPadding = parseInt(this.$(".content").css("padding-bottom")) + parseInt(this.$(".content").css("padding-top"));
                    var tileInnerSpace = this.$el.innerHeight();
                    var textFillHeight = (tileInnerSpace - contentPadding);
                    textHeight = ( textFillHeight ) + "px";
                }
                this.$(".text").css({ 
                    height: textHeight
                });

            })

        }),

        Model: LightboxTile.Model.extend({

            defaults: Backbone.ascend("defaults", function() {
                return {
                    "#showText": "true,true,true,true"
                };
            })
            
        })

    });

    Tile.register('text', TextTile);

    return TextTile;

});

;(function( $) {

	if ($.fn.haveDimensionsChanged) return;

	$.fn.haveDimensionsChanged = function(oldDimensions) {
		if (this.length === 0) return false;
		return haveDimensionsChanged(this, oldDimensions);
	};

	function haveDimensionsChanged($ele, oldDimensions) {
        oldDimensions = oldDimensions || $ele.data("dimensions");

        var height = $ele.height();
        var width = $ele.width();
        var ratio = width / height;
        var dimensions = {
            "width": width,
            "height": height,
            "ratio": ratio
        };

        var hasChanged = false;

        if (oldDimensions) {
            if (oldDimensions.ratio != dimensions.ratio) hasChanged = true;
            else if (oldDimensions.height != dimensions.height) hasChanged = true;
        }

        if (!hasChanged) return false;
           
        $ele.data("dimensions", dimensions);

        return true;

    }

    $.fn.getDimensions = function(dynamicRatio) {
		if (this.length === 0) return false;
		return getDimensions(this, dynamicRatio);
	};

    function getDimensions($ele, dynamicRatio) {
        var dimensions;
        if (dynamicRatio === undefined) dynamicRatio = false;
        if (!dynamicRatio) {
            dimensions = $ele.data("dimensions");
            if (dimensions) return dimensions;
        }
        var height;
        var width;
        if ($ele.is("img")) {
            height = $ele[0].naturalHeight || $ele[0].height;
            width = $ele[0].naturalWidth || $ele[0].width;
        } else {
            height = $ele.height();
            width = $ele.width();
        }
        var ratio = width / height;
        var dimensions = {
            "width": width,
            "height": height,
            "ratio": ratio
        };
        if (!dynamicRatio) {
            $ele.data("dimensions", dimensions);
        }
        return dimensions;
    }

})( jQuery );
define("extensions/adapt-editorial/js/lib/jquery.dimensions", function(){});

define('extensions/adapt-editorial/js/tiles/media',[
    'coreJS/adapt',
    './tile',
    './lightbox',
    '../lib/jquery.resize',
    '../lib/jquery.dimensions',
    '../lib/jquery.backgroundimage'
], function(Adapt, Tile, LightboxTile) {

    var MediaTile = Tile.extend({

        View: LightboxTile.View.extend({

            mediaSelector: ".media-item",

            classes: Backbone.ascend("classes", function() {
                return [
                    "media",
                    "content",
                    this.model.get("_linkId")
                ];
            }),

            getCalculatedStyleObject: Backbone.ascend("getCalculatedStyleObject", function() {
                var styleObject = this.model.toJSON();

                //set the ratio of text to media
                if (styleObject['_textPortion'] && (styleObject._textPosition == "left" || styleObject._textPosition == "right")) {
                
                    styleObject._textPortion = parseInt(styleObject._textPortion);
                    styleObject._mediaPortion = (100 - styleObject._textPortion) + "%";
                    styleObject._textPortion+="%";


                } else {
                    styleObject._mediaPortion = "";
                    styleObject._textPortion = "";
                }

                //space between text and media
                if (styleObject['_spaceBetween']) {
            
                    styleObject._textMargin = parseInt(styleObject._spaceBetween) + "px"
                   
                }

                return styleObject;
            }),

            renderStyle: Backbone.descend("renderStyle", function(styleObject) {

                var contentHeight = styleObject._contentHeight ? styleObject._contentHeight+"px" : "";
                this.$(".content").css({ 
                    height: contentHeight
                });

                var size = (styleObject['_mediaSize'] || "auto auto");
                var position = (styleObject['_mediaPosition'] || "top left");
                var restrict = (styleObject['_mediaRestrict'] || "auto auto");
                var dynamicRatio = (styleObject['_mediaDynamicRatio'] === undefined ? true : styleObject['_mediaDynamicRatio']);

                this.$el.backgroundImage({
                    "size": size,
                    "position": position,
                    "restrict": restrict,
                    "selector": this.mediaSelector,
                    "dynamicRatio": dynamicRatio,
                    "expandContainerHeight": this.model.get("_textBigger")
                });

                var textWidth = "";
                var textHeight = "";
                var textRoundedCorderColor = styleObject._textRoundedCornerColor || "";
                var textMarginTop = "";
                var textMarginLeft = "";
                var textMarginBottom = "";
                var textMarginRight = "";
                if (styleObject._textPosition=="left"||styleObject._textPosition=="right") {
                    textWidth = styleObject._textPortion || "";
                }
                if (styleObject._textPosition=="top"||styleObject._textPosition=="bottom") {
                    textHeight = "";
                    if (styleObject._fillHeight) {
                        var contentPadding = parseInt(this.$(".content").css("padding-bottom")) + parseInt(this.$(".content").css("padding-top"));
                        var tileInnerSpace = this.$el.innerHeight();
                        var mediaOuterHeight = this.$(".media").outerHeight();
                        var textFillHeight = (tileInnerSpace - contentPadding)- mediaOuterHeight;
                        textHeight = ( textFillHeight ) + "px";
                    }
                }
                if (styleObject._textMargin) {
                    switch (styleObject._textPosition) {
                    case "top":
                        textMargin = "0 0 " + styleObject._textMargin + "px 0";
                        textMarginBottom = styleObject._textMargin;
                        break;
                    case "left":
                        textMargin = "0 " + styleObject._textMargin + "px 0 0";
                        textMarginRight = styleObject._textMargin;
                        break;
                    case "bottom":
                        textMargin = styleObject._textMargin + "px 0 0 0";
                        textMarginTop = styleObject._textMargin;
                        break;
                    case "right":
                        textMargin = "0 0 0 " + styleObject._textMargin + "px";
                        textMarginLeft = styleObject._textMargin;
                        break;
                    }
                }
                this.$(".text").css({ 
                    position: styleObject._offsetTop ? "absolute" : "",
                    bottom: styleObject._offsetTop ? "0px" : "",
                    width: textWidth,
                    height: textHeight,
                    "margin-top": textMarginTop,
                    "margin-left": textMarginLeft,
                    "margin-bottom": textMarginBottom,
                    "margin-right": textMarginRight,
                    "background-color": textRoundedCorderColor
                });

                var mediaPortion = styleObject._hasText ? styleObject._mediaPortion || "" : "";
                this.$(".media").css({
                    "width": mediaPortion
                });

                var textBackgroundColor = styleObject._textBackgroundColor || "";
                this.$(".text .background").css({ 
                    "background-color": textBackgroundColor
                });

                var textTitleColor = styleObject._textTitleColor || "";
                this.$(".text .title").css({ 
                    "color": textTitleColor
                });

                var textTitleFontSize = styleObject._textTitleFontSize || "";
                this.$(".text .title").css({ 
                    "font-size": textTitleFontSize
                });

                var textBodyColor = styleObject._textBodyColor || "";
                this.$(".text .body").css({ 
                    "color": textBodyColor
                });

                var textInstructionColor = styleObject._textInstructionColor || "";
                this.$(".text .instruction").css({ 
                    "color": textInstructionColor
                });

                this.checkIfTextIsBiggerThanImage();

                

            }),

            checkIfTextIsBiggerThanImage: function() {
                var $text = this.$(".text");
                var $image = this.$(".media .media-item");

                switch (this.model.get("_textPosition")) {
                case "top": case "bottom":
                    this.model.set("_textBigger", false);
                    this.$el.attr("textbigger", "false");
                    return;
                case "left":
                    $text = $text.filter(".top");
                    break;
                case "right":
                    $text = $text.filter(".bottom");
                    break;
                }

                $text = $text.find(".text-inner");

                var textHeight = $text.outerHeight();
                var imageHeight = $image.outerHeight();

                var isTextBigger = textHeight > imageHeight;
                this.model.set("_textBigger", isTextBigger);
                this.$el.attr("textbigger", isTextBigger ? "true" : "false");
            }

        }),

        Model: LightboxTile.Model.extend({

            defaults: Backbone.ascend("defaults", function() {
                return {
                    "#showText": "true,true,true,true",
                    "#textPosition": "bottom,bottom,bottom,bottom",
                    "#textOverlay": "false,false,false,false",
                    "#textRounded": "false,false,false,false",
                    "#textPortion": "40%,40%,40%,40%",
                    /*"#textBackgroundColor":"rgb(127,127,127),rgb(127,127,127),rgb(127,127,127)",
                    "#textRoundedCorderColor":"rgb(0,0,0),rgb(0,0,0),rgb(0,0,0)",
                    "#spaceBetween": "0,0,0,0",*/
                    "#mediaSize": "cover,cover,cover,cover",
                    "#mediaRestrict": "100% auto,100% auto,100% auto,100% auto",
                    "#mediaPosition": "center center,center center,center center,center center",
                    "#mediaDynamicRatio": "false,false,false,false"
                };
            })
            
        })

    });

    return MediaTile;

});

define('extensions/adapt-editorial/js/tiles/e-image',[
    'coreJS/adapt',
    './media'
], function(Adapt, Media) {

    var ImageTile = { 

        View: Media.View.extend({

            checkReadyStatus: function() {
                if (this.$("img").length > 0) this.$el.imageready(_.bind(this.setReadyStatus, this), { allowTimeout: false });
                else this.setReadyStatus.call(this);
            }

        }),

        Model: Media.Model.extend({})

    };

    Media.register('image', ImageTile);

    return ImageTile;

});

/*!
* MediaElement.js
* HTML5 <video> and <audio> shim and player
* http://mediaelementjs.com/
*
* Creates a JavaScript object that mimics HTML5 MediaElement API
* for browsers that don't understand HTML5 or can't play the provided codec
* Can play MP4 (H.264), Ogg, WebM, FLV, WMV, WMA, ACC, and MP3
*
* Copyright 2010-2013, John Dyer (http://j.hn)
* License: MIT
*
*/var mejs=mejs||{};mejs.version="2.13.2";mejs.meIndex=0;
mejs.plugins={silverlight:[{version:[3,0],types:["video/mp4","video/m4v","video/mov","video/wmv","audio/wma","audio/m4a","audio/mp3","audio/wav","audio/mpeg"]}],flash:[{version:[9,0,124],types:["video/mp4","video/m4v","video/mov","video/flv","video/rtmp","video/x-flv","audio/flv","audio/x-flv","audio/mp3","audio/m4a","audio/mpeg","video/youtube","video/x-youtube"]}],youtube:[{version:null,types:["video/youtube","video/x-youtube","audio/youtube","audio/x-youtube"]}],vimeo:[{version:null,types:["video/vimeo",
"video/x-vimeo"]}]};
mejs.Utility={encodeUrl:function(a){return encodeURIComponent(a)},escapeHTML:function(a){return a.toString().split("&").join("&amp;").split("<").join("&lt;").split('"').join("&quot;")},absolutizeUrl:function(a){var b=document.createElement("div");b.innerHTML='<a href="'+this.escapeHTML(a)+'">x</a>';return b.firstChild.href},getScriptPath:function(a){for(var b=0,c,d="",e="",g,f,h=document.getElementsByTagName("script"),l=h.length,j=a.length;b<l;b++){g=h[b].src;c=g.lastIndexOf("/");if(c>-1){f=g.substring(c+
1);g=g.substring(0,c+1)}else{f=g;g=""}for(c=0;c<j;c++){e=a[c];e=f.indexOf(e);if(e>-1){d=g;break}}if(d!=="")break}return d},secondsToTimeCode:function(a,b,c,d){if(typeof c=="undefined")c=false;else if(typeof d=="undefined")d=25;var e=Math.floor(a/3600)%24,g=Math.floor(a/60)%60,f=Math.floor(a%60);a=Math.floor((a%1*d).toFixed(3));return(b||e>0?(e<10?"0"+e:e)+":":"")+(g<10?"0"+g:g)+":"+(f<10?"0"+f:f)+(c?":"+(a<10?"0"+a:a):"")},timeCodeToSeconds:function(a,b,c,d){if(typeof c=="undefined")c=false;else if(typeof d==
"undefined")d=25;a=a.split(":");b=parseInt(a[0],10);var e=parseInt(a[1],10),g=parseInt(a[2],10),f=0,h=0;if(c)f=parseInt(a[3])/d;return h=b*3600+e*60+g+f},convertSMPTEtoSeconds:function(a){if(typeof a!="string")return false;a=a.replace(",",".");var b=0,c=a.indexOf(".")!=-1?a.split(".")[1].length:0,d=1;a=a.split(":").reverse();for(var e=0;e<a.length;e++){d=1;if(e>0)d=Math.pow(60,e);b+=Number(a[e])*d}return Number(b.toFixed(c))},removeSwf:function(a){var b=document.getElementById(a);if(b&&/object|embed/i.test(b.nodeName))if(mejs.MediaFeatures.isIE){b.style.display=
"none";(function(){b.readyState==4?mejs.Utility.removeObjectInIE(a):setTimeout(arguments.callee,10)})()}else b.parentNode.removeChild(b)},removeObjectInIE:function(a){if(a=document.getElementById(a)){for(var b in a)if(typeof a[b]=="function")a[b]=null;a.parentNode.removeChild(a)}}};
mejs.PluginDetector={hasPluginVersion:function(a,b){var c=this.plugins[a];b[1]=b[1]||0;b[2]=b[2]||0;return c[0]>b[0]||c[0]==b[0]&&c[1]>b[1]||c[0]==b[0]&&c[1]==b[1]&&c[2]>=b[2]?true:false},nav:window.navigator,ua:window.navigator.userAgent.toLowerCase(),plugins:[],addPlugin:function(a,b,c,d,e){this.plugins[a]=this.detectPlugin(b,c,d,e)},detectPlugin:function(a,b,c,d){var e=[0,0,0],g;if(typeof this.nav.plugins!="undefined"&&typeof this.nav.plugins[a]=="object"){if((c=this.nav.plugins[a].description)&&
!(typeof this.nav.mimeTypes!="undefined"&&this.nav.mimeTypes[b]&&!this.nav.mimeTypes[b].enabledPlugin)){e=c.replace(a,"").replace(/^\s+/,"").replace(/\sr/gi,".").split(".");for(a=0;a<e.length;a++)e[a]=parseInt(e[a].match(/\d+/),10)}}else if(typeof window.ActiveXObject!="undefined")try{if(g=new ActiveXObject(c))e=d(g)}catch(f){}return e}};
mejs.PluginDetector.addPlugin("flash","Shockwave Flash","application/x-shockwave-flash","ShockwaveFlash.ShockwaveFlash",function(a){var b=[];if(a=a.GetVariable("$version")){a=a.split(" ")[1].split(",");b=[parseInt(a[0],10),parseInt(a[1],10),parseInt(a[2],10)]}return b});
mejs.PluginDetector.addPlugin("silverlight","Silverlight Plug-In","application/x-silverlight-2","AgControl.AgControl",function(a){var b=[0,0,0,0],c=function(d,e,g,f){for(;d.isVersionSupported(e[0]+"."+e[1]+"."+e[2]+"."+e[3]);)e[g]+=f;e[g]-=f};c(a,b,0,1);c(a,b,1,1);c(a,b,2,1E4);c(a,b,2,1E3);c(a,b,2,100);c(a,b,2,10);c(a,b,2,1);c(a,b,3,1);return b});
mejs.MediaFeatures={init:function(){var a=this,b=document,c=mejs.PluginDetector.nav,d=mejs.PluginDetector.ua.toLowerCase(),e,g=["source","track","audio","video"];a.isiPad=d.match(/ipad/i)!==null;a.isiPhone=d.match(/iphone/i)!==null;a.isiOS=a.isiPhone||a.isiPad;a.isAndroid=d.match(/android/i)!==null;a.isBustedAndroid=d.match(/android 2\.[12]/)!==null;a.isBustedNativeHTTPS=location.protocol==="https:"&&(d.match(/android [12]\./)!==null||d.match(/macintosh.* version.* safari/)!==null);a.isIE=c.appName.toLowerCase().indexOf("microsoft")!=
-1||c.appName.toLowerCase().match(/trident/gi)!==null;a.isChrome=d.match(/chrome/gi)!==null;a.isFirefox=d.match(/firefox/gi)!==null;a.isWebkit=d.match(/webkit/gi)!==null;a.isGecko=d.match(/gecko/gi)!==null&&!a.isWebkit&&!a.isIE;a.isOpera=d.match(/opera/gi)!==null;a.hasTouch="ontouchstart"in window;a.svg=!!document.createElementNS&&!!document.createElementNS("http://www.w3.org/2000/svg","svg").createSVGRect;for(c=0;c<g.length;c++)e=document.createElement(g[c]);a.supportsMediaTag=typeof e.canPlayType!==
"undefined"||a.isBustedAndroid;try{e.canPlayType("video/mp4")}catch(f){a.supportsMediaTag=false}a.hasSemiNativeFullScreen=typeof e.webkitEnterFullscreen!=="undefined";a.hasNativeFullscreen=typeof e.requestFullscreen!=="undefined";a.hasWebkitNativeFullScreen=typeof e.webkitRequestFullScreen!=="undefined";a.hasMozNativeFullScreen=typeof e.mozRequestFullScreen!=="undefined";a.hasMsNativeFullScreen=typeof e.msRequestFullscreen!=="undefined";a.hasTrueNativeFullScreen=a.hasWebkitNativeFullScreen||a.hasMozNativeFullScreen||
a.hasMsNativeFullScreen;a.nativeFullScreenEnabled=a.hasTrueNativeFullScreen;if(a.hasMozNativeFullScreen)a.nativeFullScreenEnabled=document.mozFullScreenEnabled;else if(a.hasMsNativeFullScreen)a.nativeFullScreenEnabled=document.msFullscreenEnabled;if(a.isChrome)a.hasSemiNativeFullScreen=false;if(a.hasTrueNativeFullScreen){a.fullScreenEventName="";if(a.hasWebkitNativeFullScreen)a.fullScreenEventName="webkitfullscreenchange";else if(a.hasMozNativeFullScreen)a.fullScreenEventName="mozfullscreenchange";
else if(a.hasMsNativeFullScreen)a.fullScreenEventName="MSFullscreenChange";a.isFullScreen=function(){if(e.mozRequestFullScreen)return b.mozFullScreen;else if(e.webkitRequestFullScreen)return b.webkitIsFullScreen;else if(e.hasMsNativeFullScreen)return b.msFullscreenElement!==null};a.requestFullScreen=function(h){if(a.hasWebkitNativeFullScreen)h.webkitRequestFullScreen();else if(a.hasMozNativeFullScreen)h.mozRequestFullScreen();else a.hasMsNativeFullScreen&&h.msRequestFullscreen()};a.cancelFullScreen=
function(){if(a.hasWebkitNativeFullScreen)document.webkitCancelFullScreen();else if(a.hasMozNativeFullScreen)document.mozCancelFullScreen();else a.hasMsNativeFullScreen&&document.msExitFullscreen()}}if(a.hasSemiNativeFullScreen&&d.match(/mac os x 10_5/i)){a.hasNativeFullScreen=false;a.hasSemiNativeFullScreen=false}}};mejs.MediaFeatures.init();
mejs.HtmlMediaElement={pluginType:"native",isFullScreen:false,setCurrentTime:function(a){this.currentTime=a},setMuted:function(a){this.muted=a},setVolume:function(a){this.volume=a},stop:function(){this.pause()},setSrc:function(a){for(var b=this.getElementsByTagName("source");b.length>0;)this.removeChild(b[0]);if(typeof a=="string")this.src=a;else{var c;for(b=0;b<a.length;b++){c=a[b];if(this.canPlayType(c.type)){this.src=c.src;break}}}},setVideoSize:function(a,b){this.width=a;this.height=b}};
mejs.PluginMediaElement=function(a,b,c){this.id=a;this.pluginType=b;this.src=c;this.events={};this.attributes={}};
mejs.PluginMediaElement.prototype={pluginElement:null,pluginType:"",isFullScreen:false,playbackRate:-1,defaultPlaybackRate:-1,seekable:[],played:[],paused:true,ended:false,seeking:false,duration:0,error:null,tagName:"",muted:false,volume:1,currentTime:0,play:function(){if(this.pluginApi!=null){this.pluginType=="youtube"?this.pluginApi.playVideo():this.pluginApi.playMedia();this.paused=false}},load:function(){if(this.pluginApi!=null){this.pluginType!="youtube"&&this.pluginApi.loadMedia();this.paused=
false}},pause:function(){if(this.pluginApi!=null){this.pluginType=="youtube"?this.pluginApi.pauseVideo():this.pluginApi.pauseMedia();this.paused=true}},stop:function(){if(this.pluginApi!=null){this.pluginType=="youtube"?this.pluginApi.stopVideo():this.pluginApi.stopMedia();this.paused=true}},canPlayType:function(a){var b,c,d,e=mejs.plugins[this.pluginType];for(b=0;b<e.length;b++){d=e[b];if(mejs.PluginDetector.hasPluginVersion(this.pluginType,d.version))for(c=0;c<d.types.length;c++)if(a==d.types[c])return"probably"}return""},
positionFullscreenButton:function(a,b,c){this.pluginApi!=null&&this.pluginApi.positionFullscreenButton&&this.pluginApi.positionFullscreenButton(Math.floor(a),Math.floor(b),c)},hideFullscreenButton:function(){this.pluginApi!=null&&this.pluginApi.hideFullscreenButton&&this.pluginApi.hideFullscreenButton()},setSrc:function(a){if(typeof a=="string"){this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(a));this.src=mejs.Utility.absolutizeUrl(a)}else{var b,c;for(b=0;b<a.length;b++){c=a[b];if(this.canPlayType(c.type)){this.pluginApi.setSrc(mejs.Utility.absolutizeUrl(c.src));
this.src=mejs.Utility.absolutizeUrl(a);break}}}},setCurrentTime:function(a){if(this.pluginApi!=null){this.pluginType=="youtube"?this.pluginApi.seekTo(a):this.pluginApi.setCurrentTime(a);this.currentTime=a}},setVolume:function(a){if(this.pluginApi!=null){this.pluginType=="youtube"?this.pluginApi.setVolume(a*100):this.pluginApi.setVolume(a);this.volume=a}},setMuted:function(a){if(this.pluginApi!=null){if(this.pluginType=="youtube"){a?this.pluginApi.mute():this.pluginApi.unMute();this.muted=a;this.dispatchEvent("volumechange")}else this.pluginApi.setMuted(a);
this.muted=a}},setVideoSize:function(a,b){if(this.pluginElement.style){this.pluginElement.style.width=a+"px";this.pluginElement.style.height=b+"px"}this.pluginApi!=null&&this.pluginApi.setVideoSize&&this.pluginApi.setVideoSize(a,b)},setFullscreen:function(a){this.pluginApi!=null&&this.pluginApi.setFullscreen&&this.pluginApi.setFullscreen(a)},enterFullScreen:function(){this.pluginApi!=null&&this.pluginApi.setFullscreen&&this.setFullscreen(true)},exitFullScreen:function(){this.pluginApi!=null&&this.pluginApi.setFullscreen&&
this.setFullscreen(false)},addEventListener:function(a,b){this.events[a]=this.events[a]||[];this.events[a].push(b)},removeEventListener:function(a,b){if(!a){this.events={};return true}var c=this.events[a];if(!c)return true;if(!b){this.events[a]=[];return true}for(i=0;i<c.length;i++)if(c[i]===b){this.events[a].splice(i,1);return true}return false},dispatchEvent:function(a){var b,c,d=this.events[a];if(d){c=Array.prototype.slice.call(arguments,1);for(b=0;b<d.length;b++)d[b].apply(null,c)}},hasAttribute:function(a){return a in
this.attributes},removeAttribute:function(a){delete this.attributes[a]},getAttribute:function(a){if(this.hasAttribute(a))return this.attributes[a];return""},setAttribute:function(a,b){this.attributes[a]=b},remove:function(){mejs.Utility.removeSwf(this.pluginElement.id);mejs.MediaPluginBridge.unregisterPluginElement(this.pluginElement.id)}};
mejs.MediaPluginBridge={pluginMediaElements:{},htmlMediaElements:{},registerPluginElement:function(a,b,c){this.pluginMediaElements[a]=b;this.htmlMediaElements[a]=c},unregisterPluginElement:function(a){delete this.pluginMediaElements[a];delete this.htmlMediaElements[a]},initPlugin:function(a){var b=this.pluginMediaElements[a],c=this.htmlMediaElements[a];if(b){switch(b.pluginType){case "flash":b.pluginElement=b.pluginApi=document.getElementById(a);break;case "silverlight":b.pluginElement=document.getElementById(b.id);
b.pluginApi=b.pluginElement.Content.MediaElementJS}b.pluginApi!=null&&b.success&&b.success(b,c)}},fireEvent:function(a,b,c){var d,e;if(a=this.pluginMediaElements[a]){b={type:b,target:a};for(d in c){a[d]=c[d];b[d]=c[d]}e=c.bufferedTime||0;b.target.buffered=b.buffered={start:function(){return 0},end:function(){return e},length:1};a.dispatchEvent(b.type,b)}}};
mejs.MediaElementDefaults={mode:"auto",plugins:["flash","silverlight","youtube","vimeo"],enablePluginDebug:false,httpsBasicAuthSite:false,type:"",pluginPath:mejs.Utility.getScriptPath(["mediaelement.js","mediaelement.min.js","mediaelement-and-player.js","mediaelement-and-player.min.js"]),flashName:"flashmediaelement.swf",flashStreamer:"",enablePluginSmoothing:false,enablePseudoStreaming:false,pseudoStreamingStartQueryParam:"start",silverlightName:"silverlightmediaelement.xap",defaultVideoWidth:480,
defaultVideoHeight:270,pluginWidth:-1,pluginHeight:-1,pluginVars:[],timerRate:250,startVolume:0.8,success:function(){},error:function(){}};mejs.MediaElement=function(a,b){return mejs.HtmlMediaElementShim.create(a,b)};
mejs.HtmlMediaElementShim={create:function(a,b){var c=mejs.MediaElementDefaults,d=typeof a=="string"?document.getElementById(a):a,e=d.tagName.toLowerCase(),g=e==="audio"||e==="video",f=g?d.getAttribute("src"):d.getAttribute("href");e=d.getAttribute("poster");var h=d.getAttribute("autoplay"),l=d.getAttribute("preload"),j=d.getAttribute("controls"),k;for(k in b)c[k]=b[k];f=typeof f=="undefined"||f===null||f==""?null:f;e=typeof e=="undefined"||e===null?"":e;l=typeof l=="undefined"||l===null||l==="false"?
"none":l;h=!(typeof h=="undefined"||h===null||h==="false");j=!(typeof j=="undefined"||j===null||j==="false");k=this.determinePlayback(d,c,mejs.MediaFeatures.supportsMediaTag,g,f);k.url=k.url!==null?mejs.Utility.absolutizeUrl(k.url):"";if(k.method=="native"){if(mejs.MediaFeatures.isBustedAndroid){d.src=k.url;d.addEventListener("click",function(){d.play()},false)}return this.updateNative(k,c,h,l)}else if(k.method!=="")return this.createPlugin(k,c,e,h,l,j);else{this.createErrorMessage(k,c,e);return this}},
determinePlayback:function(a,b,c,d,e){var g=[],f,h,l,j={method:"",url:"",htmlMediaElement:a,isVideo:a.tagName.toLowerCase()!="audio"},k;if(typeof b.type!="undefined"&&b.type!=="")if(typeof b.type=="string")g.push({type:b.type,url:e});else for(f=0;f<b.type.length;f++)g.push({type:b.type[f],url:e});else if(e!==null){l=this.formatType(e,a.getAttribute("type"));g.push({type:l,url:e})}else for(f=0;f<a.childNodes.length;f++){h=a.childNodes[f];if(h.nodeType==1&&h.tagName.toLowerCase()=="source"){e=h.getAttribute("src");
l=this.formatType(e,h.getAttribute("type"));h=h.getAttribute("media");if(!h||!window.matchMedia||window.matchMedia&&window.matchMedia(h).matches)g.push({type:l,url:e})}}if(!d&&g.length>0&&g[0].url!==null&&this.getTypeFromFile(g[0].url).indexOf("audio")>-1)j.isVideo=false;if(mejs.MediaFeatures.isBustedAndroid)a.canPlayType=function(m){return m.match(/video\/(mp4|m4v)/gi)!==null?"maybe":""};if(c&&(b.mode==="auto"||b.mode==="auto_plugin"||b.mode==="native")&&!(mejs.MediaFeatures.isBustedNativeHTTPS&&
b.httpsBasicAuthSite===true)){if(!d){f=document.createElement(j.isVideo?"video":"audio");a.parentNode.insertBefore(f,a);a.style.display="none";j.htmlMediaElement=a=f}for(f=0;f<g.length;f++)if(a.canPlayType(g[f].type).replace(/no/,"")!==""||a.canPlayType(g[f].type.replace(/mp3/,"mpeg")).replace(/no/,"")!==""){j.method="native";j.url=g[f].url;break}if(j.method==="native"){if(j.url!==null)a.src=j.url;if(b.mode!=="auto_plugin")return j}}if(b.mode==="auto"||b.mode==="auto_plugin"||b.mode==="shim")for(f=
0;f<g.length;f++){l=g[f].type;for(a=0;a<b.plugins.length;a++){e=b.plugins[a];h=mejs.plugins[e];for(c=0;c<h.length;c++){k=h[c];if(k.version==null||mejs.PluginDetector.hasPluginVersion(e,k.version))for(d=0;d<k.types.length;d++)if(l==k.types[d]){j.method=e;j.url=g[f].url;return j}}}}if(b.mode==="auto_plugin"&&j.method==="native")return j;if(j.method===""&&g.length>0)j.url=g[0].url;return j},formatType:function(a,b){return a&&!b?this.getTypeFromFile(a):b&&~b.indexOf(";")?b.substr(0,b.indexOf(";")):b},
getTypeFromFile:function(a){a=a.split("?")[0];a=a.substring(a.lastIndexOf(".")+1).toLowerCase();return(/(mp4|m4v|ogg|ogv|webm|webmv|flv|wmv|mpeg|mov)/gi.test(a)?"video":"audio")+"/"+this.getTypeFromExtension(a)},getTypeFromExtension:function(a){switch(a){case "mp4":case "m4v":return"mp4";case "webm":case "webma":case "webmv":return"webm";case "ogg":case "oga":case "ogv":return"ogg";default:return a}},createErrorMessage:function(a,b,c){var d=a.htmlMediaElement,e=document.createElement("div");e.className=
"me-cannotplay";try{e.style.width=d.width+"px";e.style.height=d.height+"px"}catch(g){}e.innerHTML=b.customError?b.customError:c!==""?'<a href="'+a.url+'"><img src="'+c+'" width="100%" height="100%" /></a>':'<a href="'+a.url+'"><span>'+mejs.i18n.t("Download File")+"</span></a>";d.parentNode.insertBefore(e,d);d.style.display="none";b.error(d)},createPlugin:function(a,b,c,d,e,g){c=a.htmlMediaElement;var f=1,h=1,l="me_"+a.method+"_"+mejs.meIndex++,j=new mejs.PluginMediaElement(l,a.method,a.url),k=document.createElement("div"),
m;j.tagName=c.tagName;for(m=0;m<c.attributes.length;m++){var n=c.attributes[m];n.specified==true&&j.setAttribute(n.name,n.value)}for(m=c.parentNode;m!==null&&m.tagName.toLowerCase()!="body";){if(m.parentNode.tagName.toLowerCase()=="p"){m.parentNode.parentNode.insertBefore(m,m.parentNode);break}m=m.parentNode}if(a.isVideo){f=b.pluginWidth>0?b.pluginWidth:b.videoWidth>0?b.videoWidth:c.getAttribute("width")!==null?c.getAttribute("width"):b.defaultVideoWidth;h=b.pluginHeight>0?b.pluginHeight:b.videoHeight>
0?b.videoHeight:c.getAttribute("height")!==null?c.getAttribute("height"):b.defaultVideoHeight;f=mejs.Utility.encodeUrl(f);h=mejs.Utility.encodeUrl(h)}else if(b.enablePluginDebug){f=320;h=240}j.success=b.success;mejs.MediaPluginBridge.registerPluginElement(l,j,c);k.className="me-plugin";k.id=l+"_container";a.isVideo?c.parentNode.insertBefore(k,c):document.body.insertBefore(k,document.body.childNodes[0]);d=["id="+l,"isvideo="+(a.isVideo?"true":"false"),"autoplay="+(d?"true":"false"),"preload="+e,"width="+
f,"startvolume="+b.startVolume,"timerrate="+b.timerRate,"flashstreamer="+b.flashStreamer,"height="+h,"pseudostreamstart="+b.pseudoStreamingStartQueryParam];if(a.url!==null)a.method=="flash"?d.push("file="+mejs.Utility.encodeUrl(a.url)):d.push("file="+a.url);b.enablePluginDebug&&d.push("debug=true");b.enablePluginSmoothing&&d.push("smoothing=true");b.enablePseudoStreaming&&d.push("pseudostreaming=true");g&&d.push("controls=true");if(b.pluginVars)d=d.concat(b.pluginVars);switch(a.method){case "silverlight":k.innerHTML=
'<object data="data:application/x-silverlight-2," type="application/x-silverlight-2" id="'+l+'" name="'+l+'" width="'+f+'" height="'+h+'" class="mejs-shim"><param name="initParams" value="'+d.join(",")+'" /><param name="windowless" value="true" /><param name="background" value="black" /><param name="minRuntimeVersion" value="3.0.0.0" /><param name="autoUpgrade" value="true" /><param name="source" value="'+b.pluginPath+b.silverlightName+'" /></object>';break;case "flash":if(mejs.MediaFeatures.isIE){a=
document.createElement("div");k.appendChild(a);a.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" id="'+l+'" width="'+f+'" height="'+h+'" class="mejs-shim"><param name="movie" value="'+b.pluginPath+b.flashName+"?x="+new Date+'" /><param name="flashvars" value="'+d.join("&amp;")+'" /><param name="quality" value="high" /><param name="bgcolor" value="#000000" /><param name="wmode" value="transparent" /><param name="allowScriptAccess" value="always" /><param name="allowFullScreen" value="true" /><param name="scale" value="default" /></object>'}else k.innerHTML=
'<embed id="'+l+'" name="'+l+'" play="true" loop="false" quality="high" bgcolor="#000000" wmode="transparent" allowScriptAccess="always" allowFullScreen="true" type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer" src="'+b.pluginPath+b.flashName+'" flashvars="'+d.join("&")+'" width="'+f+'" height="'+h+'" scale="default"class="mejs-shim"></embed>';break;case "youtube":b=a.url.substr(a.url.lastIndexOf("=")+1);youtubeSettings={container:k,containerId:k.id,pluginMediaElement:j,
pluginId:l,videoId:b,height:h,width:f};mejs.PluginDetector.hasPluginVersion("flash",[10,0,0])?mejs.YouTubeApi.createFlash(youtubeSettings):mejs.YouTubeApi.enqueueIframe(youtubeSettings);break;case "vimeo":j.vimeoid=a.url.substr(a.url.lastIndexOf("/")+1);k.innerHTML='<iframe src="http://player.vimeo.com/video/'+j.vimeoid+'?portrait=0&byline=0&title=0" width="'+f+'" height="'+h+'" frameborder="0" class="mejs-shim"></iframe>'}c.style.display="none";c.removeAttribute("autoplay");return j},updateNative:function(a,
b){var c=a.htmlMediaElement,d;for(d in mejs.HtmlMediaElement)c[d]=mejs.HtmlMediaElement[d];b.success(c,c);return c}};
mejs.YouTubeApi={isIframeStarted:false,isIframeLoaded:false,loadIframeApi:function(){if(!this.isIframeStarted){var a=document.createElement("script");a.src="//www.youtube.com/player_api";var b=document.getElementsByTagName("script")[0];b.parentNode.insertBefore(a,b);this.isIframeStarted=true}},iframeQueue:[],enqueueIframe:function(a){if(this.isLoaded)this.createIframe(a);else{this.loadIframeApi();this.iframeQueue.push(a)}},createIframe:function(a){var b=a.pluginMediaElement,c=new YT.Player(a.containerId,
{height:a.height,width:a.width,videoId:a.videoId,playerVars:{controls:0},events:{onReady:function(){a.pluginMediaElement.pluginApi=c;mejs.MediaPluginBridge.initPlugin(a.pluginId);setInterval(function(){mejs.YouTubeApi.createEvent(c,b,"timeupdate")},250)},onStateChange:function(d){mejs.YouTubeApi.handleStateChange(d.data,c,b)}}})},createEvent:function(a,b,c){c={type:c,target:b};if(a&&a.getDuration){b.currentTime=c.currentTime=a.getCurrentTime();b.duration=c.duration=a.getDuration();c.paused=b.paused;
c.ended=b.ended;c.muted=a.isMuted();c.volume=a.getVolume()/100;c.bytesTotal=a.getVideoBytesTotal();c.bufferedBytes=a.getVideoBytesLoaded();var d=c.bufferedBytes/c.bytesTotal*c.duration;c.target.buffered=c.buffered={start:function(){return 0},end:function(){return d},length:1}}b.dispatchEvent(c.type,c)},iFrameReady:function(){for(this.isIframeLoaded=this.isLoaded=true;this.iframeQueue.length>0;)this.createIframe(this.iframeQueue.pop())},flashPlayers:{},createFlash:function(a){this.flashPlayers[a.pluginId]=
a;var b,c="//www.youtube.com/apiplayer?enablejsapi=1&amp;playerapiid="+a.pluginId+"&amp;version=3&amp;autoplay=0&amp;controls=0&amp;modestbranding=1&loop=0";if(mejs.MediaFeatures.isIE){b=document.createElement("div");a.container.appendChild(b);b.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" id="'+a.pluginId+'" width="'+a.width+'" height="'+a.height+'" class="mejs-shim"><param name="movie" value="'+
c+'" /><param name="wmode" value="transparent" /><param name="allowScriptAccess" value="always" /><param name="allowFullScreen" value="true" /></object>'}else a.container.innerHTML='<object type="application/x-shockwave-flash" id="'+a.pluginId+'" data="'+c+'" width="'+a.width+'" height="'+a.height+'" style="visibility: visible; " class="mejs-shim"><param name="allowScriptAccess" value="always"><param name="wmode" value="transparent"></object>'},flashReady:function(a){var b=this.flashPlayers[a],c=
document.getElementById(a),d=b.pluginMediaElement;d.pluginApi=d.pluginElement=c;mejs.MediaPluginBridge.initPlugin(a);c.cueVideoById(b.videoId);a=b.containerId+"_callback";window[a]=function(e){mejs.YouTubeApi.handleStateChange(e,c,d)};c.addEventListener("onStateChange",a);setInterval(function(){mejs.YouTubeApi.createEvent(c,d,"timeupdate")},250)},handleStateChange:function(a,b,c){switch(a){case -1:c.paused=true;c.ended=true;mejs.YouTubeApi.createEvent(b,c,"loadedmetadata");break;case 0:c.paused=false;
c.ended=true;mejs.YouTubeApi.createEvent(b,c,"ended");break;case 1:c.paused=false;c.ended=false;mejs.YouTubeApi.createEvent(b,c,"play");mejs.YouTubeApi.createEvent(b,c,"playing");break;case 2:c.paused=true;c.ended=false;mejs.YouTubeApi.createEvent(b,c,"pause");break;case 3:mejs.YouTubeApi.createEvent(b,c,"progress")}}};function onYouTubePlayerAPIReady(){mejs.YouTubeApi.iFrameReady()}function onYouTubePlayerReady(a){mejs.YouTubeApi.flashReady(a)}window.mejs=mejs;window.MediaElement=mejs.MediaElement;
(function(a,b){var c={locale:{language:"",strings:{}},methods:{}};c.getLanguage=function(){return(c.locale.language||window.navigator.userLanguage||window.navigator.language).substr(0,2).toLowerCase()};if(typeof mejsL10n!="undefined")c.locale.language=mejsL10n.language;c.methods.checkPlain=function(d){var e,g,f={"&":"&amp;",'"':"&quot;","<":"&lt;",">":"&gt;"};d=String(d);for(e in f)if(f.hasOwnProperty(e)){g=RegExp(e,"g");d=d.replace(g,f[e])}return d};c.methods.t=function(d,e){if(c.locale.strings&&
c.locale.strings[e.context]&&c.locale.strings[e.context][d])d=c.locale.strings[e.context][d];return c.methods.checkPlain(d)};c.t=function(d,e){if(typeof d==="string"&&d.length>0){var g=c.getLanguage();e=e||{context:g};return c.methods.t(d,e)}else throw{name:"InvalidArgumentException",message:"First argument is either not a string or empty."};};b.i18n=c})(document,mejs);(function(a){if(typeof mejsL10n!="undefined")a[mejsL10n.language]=mejsL10n.strings})(mejs.i18n.locale.strings);
(function(a){if(typeof a.de==="undefined")a.de={Fullscreen:"Vollbild","Go Fullscreen":"Vollbild an","Turn off Fullscreen":"Vollbild aus",Close:"Schlie\u00dfen"}})(mejs.i18n.locale.strings);(function(a){if(typeof a.zh==="undefined")a.zh={Fullscreen:"\u5168\u87a2\u5e55","Go Fullscreen":"\u5168\u5c4f\u6a21\u5f0f","Turn off Fullscreen":"\u9000\u51fa\u5168\u5c4f\u6a21\u5f0f",Close:"\u95dc\u9589"}})(mejs.i18n.locale.strings);

/*!
 * MediaElementPlayer
 * http://mediaelementjs.com/
 *
 * Creates a controller bar for HTML5 <video> add <audio> tags
 * using jQuery and MediaElement.js (HTML5 Flash/Silverlight wrapper)
 *
 * Copyright 2010-2013, John Dyer (http://j.hn/)
 * License: MIT
 *
 */if(typeof jQuery!="undefined")mejs.$=jQuery;else if(typeof ender!="undefined")mejs.$=ender;
(function(f){mejs.MepDefaults={poster:"",showPosterWhenEnded:false,defaultVideoWidth:480,defaultVideoHeight:270,videoWidth:-1,videoHeight:-1,defaultAudioWidth:400,defaultAudioHeight:30,defaultSeekBackwardInterval:function(a){return a.duration*0.05},defaultSeekForwardInterval:function(a){return a.duration*0.05},audioWidth:-1,audioHeight:-1,startVolume:0.8,loop:false,autoRewind:true,enableAutosize:true,alwaysShowHours:false,showTimecodeFrameCount:false,framesPerSecond:25,autosizeProgress:true,alwaysShowControls:false,
hideVideoControlsOnLoad:false,clickToPlayPause:true,iPadUseNativeControls:false,iPhoneUseNativeControls:false,AndroidUseNativeControls:false,features:["playpause","current","progress","duration","tracks","volume","fullscreen"],isVideo:true,enableKeyboard:true,pauseOtherPlayers:true,keyActions:[{keys:[32,179],action:function(a,b){b.paused||b.ended?a.play():a.pause()}},{keys:[38],action:function(a,b){b.setVolume(Math.min(b.volume+0.1,1))}},{keys:[40],action:function(a,b){b.setVolume(Math.max(b.volume-
0.1,0))}},{keys:[37,227],action:function(a,b){if(!isNaN(b.duration)&&b.duration>0){if(a.isVideo){a.showControls();a.startControlsTimer()}var c=Math.max(b.currentTime-a.options.defaultSeekBackwardInterval(b),0);b.setCurrentTime(c)}}},{keys:[39,228],action:function(a,b){if(!isNaN(b.duration)&&b.duration>0){if(a.isVideo){a.showControls();a.startControlsTimer()}var c=Math.min(b.currentTime+a.options.defaultSeekForwardInterval(b),b.duration);b.setCurrentTime(c)}}},{keys:[70],action:function(a){if(typeof a.enterFullScreen!=
"undefined")a.isFullScreen?a.exitFullScreen():a.enterFullScreen()}}]};mejs.mepIndex=0;mejs.players={};mejs.MediaElementPlayer=function(a,b){if(!(this instanceof mejs.MediaElementPlayer))return new mejs.MediaElementPlayer(a,b);this.$media=this.$node=f(a);this.node=this.media=this.$media[0];if(typeof this.node.player!="undefined")return this.node.player;else this.node.player=this;if(typeof b=="undefined")b=this.$node.data("mejsoptions");this.options=f.extend({},mejs.MepDefaults,b);this.id="mep_"+mejs.mepIndex++;
mejs.players[this.id]=this;this.init();return this};mejs.MediaElementPlayer.prototype={hasFocus:false,controlsAreVisible:true,init:function(){var a=this,b=mejs.MediaFeatures,c=f.extend(true,{},a.options,{success:function(d,g){a.meReady(d,g)},error:function(d){a.handleError(d)}}),e=a.media.tagName.toLowerCase();a.isDynamic=e!=="audio"&&e!=="video";a.isVideo=a.isDynamic?a.options.isVideo:e!=="audio"&&a.options.isVideo;if(b.isiPad&&a.options.iPadUseNativeControls||b.isiPhone&&a.options.iPhoneUseNativeControls){a.$media.attr("controls",
"controls");b.isiPad&&a.media.getAttribute("autoplay")!==null&&a.play()}else if(!(b.isAndroid&&a.options.AndroidUseNativeControls)){a.$media.removeAttr("controls");a.container=f('<div id="'+a.id+'" class="mejs-container '+(mejs.MediaFeatures.svg?"svg":"no-svg")+'"><div class="mejs-inner"><div class="mejs-mediaelement"></div><div class="mejs-layers"></div><div class="mejs-controls"></div><div class="mejs-clear"></div></div></div>').addClass(a.$media[0].className).insertBefore(a.$media);a.container.addClass((b.isAndroid?
"mejs-android ":"")+(b.isiOS?"mejs-ios ":"")+(b.isiPad?"mejs-ipad ":"")+(b.isiPhone?"mejs-iphone ":"")+(a.isVideo?"mejs-video ":"mejs-audio "));if(b.isiOS){b=a.$media.clone();a.container.find(".mejs-mediaelement").append(b);a.$media.remove();a.$node=a.$media=b;a.node=a.media=b[0]}else a.container.find(".mejs-mediaelement").append(a.$media);a.controls=a.container.find(".mejs-controls");a.layers=a.container.find(".mejs-layers");b=a.isVideo?"video":"audio";e=b.substring(0,1).toUpperCase()+b.substring(1);
a.width=a.options[b+"Width"]>0||a.options[b+"Width"].toString().indexOf("%")>-1?a.options[b+"Width"]:a.media.style.width!==""&&a.media.style.width!==null?a.media.style.width:a.media.getAttribute("width")!==null?a.$media.attr("width"):a.options["default"+e+"Width"];a.height=a.options[b+"Height"]>0||a.options[b+"Height"].toString().indexOf("%")>-1?a.options[b+"Height"]:a.media.style.height!==""&&a.media.style.height!==null?a.media.style.height:a.$media[0].getAttribute("height")!==null?a.$media.attr("height"):
a.options["default"+e+"Height"];a.setPlayerSize(a.width,a.height);c.pluginWidth=a.width;c.pluginHeight=a.height}mejs.MediaElement(a.$media[0],c);typeof a.container!="undefined"&&a.controlsAreVisible&&a.container.trigger("controlsshown")},showControls:function(a){var b=this;a=typeof a=="undefined"||a;if(!b.controlsAreVisible){if(a){b.controls.css("visibility","visible").stop(true,true).fadeIn(200,function(){b.controlsAreVisible=true;b.container.trigger("controlsshown")});b.container.find(".mejs-control").css("visibility",
"visible").stop(true,true).fadeIn(200,function(){b.controlsAreVisible=true})}else{b.controls.css("visibility","visible").css("display","block");b.container.find(".mejs-control").css("visibility","visible").css("display","block");b.controlsAreVisible=true;b.container.trigger("controlsshown")}b.setControlsSize()}},hideControls:function(a){var b=this;a=typeof a=="undefined"||a;if(!(!b.controlsAreVisible||b.options.alwaysShowControls))if(a){b.controls.stop(true,true).fadeOut(200,function(){f(this).css("visibility",
"hidden").css("display","block");b.controlsAreVisible=false;b.container.trigger("controlshidden")});b.container.find(".mejs-control").stop(true,true).fadeOut(200,function(){f(this).css("visibility","hidden").css("display","block")})}else{b.controls.css("visibility","hidden").css("display","block");b.container.find(".mejs-control").css("visibility","hidden").css("display","block");b.controlsAreVisible=false;b.container.trigger("controlshidden")}},controlsTimer:null,startControlsTimer:function(a){var b=
this;a=typeof a!="undefined"?a:1500;b.killControlsTimer("start");b.controlsTimer=setTimeout(function(){b.hideControls();b.killControlsTimer("hide")},a)},killControlsTimer:function(){if(this.controlsTimer!==null){clearTimeout(this.controlsTimer);delete this.controlsTimer;this.controlsTimer=null}},controlsEnabled:true,disableControls:function(){this.killControlsTimer();this.hideControls(false);this.controlsEnabled=false},enableControls:function(){this.showControls(false);this.controlsEnabled=true},
meReady:function(a,b){var c=this,e=mejs.MediaFeatures,d=b.getAttribute("autoplay");d=!(typeof d=="undefined"||d===null||d==="false");var g;if(!c.created){c.created=true;c.media=a;c.domNode=b;if(!(e.isAndroid&&c.options.AndroidUseNativeControls)&&!(e.isiPad&&c.options.iPadUseNativeControls)&&!(e.isiPhone&&c.options.iPhoneUseNativeControls)){c.buildposter(c,c.controls,c.layers,c.media);c.buildkeyboard(c,c.controls,c.layers,c.media);c.buildoverlays(c,c.controls,c.layers,c.media);c.findTracks();for(g in c.options.features){e=
c.options.features[g];if(c["build"+e])try{c["build"+e](c,c.controls,c.layers,c.media)}catch(k){}}c.container.trigger("controlsready");c.setPlayerSize(c.width,c.height);c.setControlsSize();if(c.isVideo){if(mejs.MediaFeatures.hasTouch)c.$media.bind("touchstart",function(){if(c.controlsAreVisible)c.hideControls(false);else c.controlsEnabled&&c.showControls(false)});else{mejs.MediaElementPlayer.prototype.clickToPlayPauseCallback=function(){if(c.options.clickToPlayPause)c.media.paused?c.play():c.pause()};
c.media.addEventListener("click",c.clickToPlayPauseCallback,false);c.container.bind("mouseenter mouseover",function(){if(c.controlsEnabled)if(!c.options.alwaysShowControls){c.killControlsTimer("enter");c.showControls();c.startControlsTimer(2500)}}).bind("mousemove",function(){if(c.controlsEnabled){c.controlsAreVisible||c.showControls();c.options.alwaysShowControls||c.startControlsTimer(2500)}}).bind("mouseleave",function(){c.controlsEnabled&&!c.media.paused&&!c.options.alwaysShowControls&&c.startControlsTimer(1E3)})}c.options.hideVideoControlsOnLoad&&
c.hideControls(false);d&&!c.options.alwaysShowControls&&c.hideControls();c.options.enableAutosize&&c.media.addEventListener("loadedmetadata",function(j){if(c.options.videoHeight<=0&&c.domNode.getAttribute("height")===null&&!isNaN(j.target.videoHeight)){c.setPlayerSize(j.target.videoWidth,j.target.videoHeight);c.setControlsSize();c.media.setVideoSize(j.target.videoWidth,j.target.videoHeight)}},false)}a.addEventListener("play",function(){for(var j in mejs.players){var m=mejs.players[j];m.id!=c.id&&
c.options.pauseOtherPlayers&&!m.paused&&!m.ended&&m.pause();m.hasFocus=false}c.hasFocus=true},false);c.media.addEventListener("ended",function(){if(c.options.autoRewind)try{c.media.setCurrentTime(0)}catch(j){}c.media.pause();c.setProgressRail&&c.setProgressRail();c.setCurrentRail&&c.setCurrentRail();if(c.options.loop)c.play();else!c.options.alwaysShowControls&&c.controlsEnabled&&c.showControls()},false);c.media.addEventListener("loadedmetadata",function(){c.updateDuration&&c.updateDuration();c.updateCurrent&&
c.updateCurrent();if(!c.isFullScreen){c.setPlayerSize(c.width,c.height);c.setControlsSize()}},false);setTimeout(function(){c.setPlayerSize(c.width,c.height);c.setControlsSize()},50);c.globalBind("resize",function(){c.isFullScreen||mejs.MediaFeatures.hasTrueNativeFullScreen&&document.webkitIsFullScreen||c.setPlayerSize(c.width,c.height);c.setControlsSize()});c.media.pluginType=="youtube"&&c.container.find(".mejs-overlay-play").hide()}d&&a.pluginType=="native"&&c.play();if(c.options.success)typeof c.options.success==
"string"?window[c.options.success](c.media,c.domNode,c):c.options.success(c.media,c.domNode,c)}},handleError:function(a){this.controls.hide();this.options.error&&this.options.error(a)},setPlayerSize:function(a,b){if(typeof a!="undefined")this.width=a;if(typeof b!="undefined")this.height=b;if(this.height.toString().indexOf("%")>0||this.$node.css("max-width")==="100%"||parseInt(this.$node.css("max-width").replace(/px/,""),10)/this.$node.offsetParent().width()===1||this.$node[0].currentStyle&&this.$node[0].currentStyle.maxWidth===
"100%"){var c=this.isVideo?this.media.videoWidth&&this.media.videoWidth>0?this.media.videoWidth:this.options.defaultVideoWidth:this.options.defaultAudioWidth,e=this.isVideo?this.media.videoHeight&&this.media.videoHeight>0?this.media.videoHeight:this.options.defaultVideoHeight:this.options.defaultAudioHeight,d=this.container.parent().closest(":visible").width();c=this.isVideo||!this.options.autosizeProgress?parseInt(d*e/c,10):e;if(this.container.parent()[0].tagName.toLowerCase()==="body"){d=f(window).width();
c=f(window).height()}if(c!=0&&d!=0){this.container.width(d).height(c);this.$media.add(this.container.find(".mejs-shim")).width("100%").height("100%");this.isVideo&&this.media.setVideoSize&&this.media.setVideoSize(d,c);this.layers.children(".mejs-layer").width("100%").height("100%")}}else{this.container.width(this.width).height(this.height);this.layers.children(".mejs-layer").width(this.width).height(this.height)}d=this.layers.find(".mejs-overlay-play");c=d.find(".mejs-overlay-button");d.height(this.container.height()-
this.controls.height());c.css("margin-top","-"+(c.height()/2-this.controls.height()/2).toString()+"px")},setControlsSize:function(){var a=0,b=0,c=this.controls.find(".mejs-time-rail"),e=this.controls.find(".mejs-time-total");this.controls.find(".mejs-time-current");this.controls.find(".mejs-time-loaded");var d=c.siblings();if(this.options&&!this.options.autosizeProgress)b=parseInt(c.css("width"));if(b===0||!b){d.each(function(){var g=f(this);if(g.css("position")!="absolute"&&g.is(":visible"))a+=f(this).outerWidth(true)});
b=this.controls.width()-a-(c.outerWidth(true)-c.width())}b=b-1;c.width(b);e.width(b-(e.outerWidth(true)-e.width()));this.setProgressRail&&this.setProgressRail();this.setCurrentRail&&this.setCurrentRail()},buildposter:function(a,b,c,e){var d=f('<div class="mejs-poster mejs-layer"></div>').appendTo(c);b=a.$media.attr("poster");if(a.options.poster!=="")b=a.options.poster;b!==""&&b!=null?this.setPoster(b):d.hide();e.addEventListener("play",function(){d.hide()},false);a.options.showPosterWhenEnded&&a.options.autoRewind&&
e.addEventListener("ended",function(){d.show()},false)},setPoster:function(a){var b=this.container.find(".mejs-poster"),c=b.find("img");if(c.length==0)c=f('<img width="100%" height="100%" />').appendTo(b);c.attr("src",a);b.css({"background-image":"url("+a+")"})},buildoverlays:function(a,b,c,e){var d=this;if(a.isVideo){var g=f('<div class="mejs-overlay mejs-layer"><div class="mejs-overlay-loading"><span></span></div></div>').hide().appendTo(c),k=f('<div class="mejs-overlay mejs-layer"><div class="mejs-overlay-error"></div></div>').hide().appendTo(c),
j=f('<div class="mejs-overlay mejs-layer mejs-overlay-play"><div class="mejs-overlay-button"></div></div>').appendTo(c).bind("click touchstart",function(){d.options.clickToPlayPause&&e.paused&&d.play()});e.addEventListener("play",function(){j.hide();g.hide();b.find(".mejs-time-buffering").hide();k.hide()},false);e.addEventListener("playing",function(){j.hide();g.hide();b.find(".mejs-time-buffering").hide();k.hide()},false);e.addEventListener("seeking",function(){g.show();b.find(".mejs-time-buffering").show()},
false);e.addEventListener("seeked",function(){g.hide();b.find(".mejs-time-buffering").hide()},false);e.addEventListener("pause",function(){mejs.MediaFeatures.isiPhone||j.show()},false);e.addEventListener("waiting",function(){g.show();b.find(".mejs-time-buffering").show()},false);e.addEventListener("loadeddata",function(){g.show();b.find(".mejs-time-buffering").show()},false);e.addEventListener("canplay",function(){g.hide();b.find(".mejs-time-buffering").hide()},false);e.addEventListener("error",function(){g.hide();
b.find(".mejs-time-buffering").hide();k.show();k.find("mejs-overlay-error").html("Error loading this resource")},false)}},buildkeyboard:function(a,b,c,e){this.globalBind("keydown",function(d){if(a.hasFocus&&a.options.enableKeyboard)for(var g=0,k=a.options.keyActions.length;g<k;g++)for(var j=a.options.keyActions[g],m=0,q=j.keys.length;m<q;m++)if(d.keyCode==j.keys[m]){d.preventDefault();j.action(a,e,d.keyCode);return false}return true});this.globalBind("click",function(d){if(f(d.target).closest(".mejs-container").length==
0)a.hasFocus=false})},findTracks:function(){var a=this,b=a.$media.find("track");a.tracks=[];b.each(function(c,e){e=f(e);a.tracks.push({srclang:e.attr("srclang")?e.attr("srclang").toLowerCase():"",src:e.attr("src"),kind:e.attr("kind"),label:e.attr("label")||"",entries:[],isLoaded:false})})},changeSkin:function(a){this.container[0].className="mejs-container "+a;this.setPlayerSize(this.width,this.height);this.setControlsSize()},play:function(){this.load();this.media.play()},pause:function(){try{this.media.pause()}catch(a){}},
load:function(){this.isLoaded||this.media.load();this.isLoaded=true},setMuted:function(a){this.media.setMuted(a)},setCurrentTime:function(a){this.media.setCurrentTime(a)},getCurrentTime:function(){return this.media.currentTime},setVolume:function(a){this.media.setVolume(a)},getVolume:function(){return this.media.volume},setSrc:function(a){this.media.setSrc(a)},remove:function(){var a,b;for(a in this.options.features){b=this.options.features[a];if(this["clean"+b])try{this["clean"+b](this)}catch(c){}}if(this.isDynamic)this.$node.insertBefore(this.container);
else{this.$media.prop("controls",true);this.$node.clone().show().insertBefore(this.container);this.$node.remove()}this.media.pluginType!=="native"&&this.media.remove();delete mejs.players[this.id];this.container.remove();this.globalUnbind();delete this.node.player}};(function(){function a(c,e){var d={d:[],w:[]};f.each((c||"").split(" "),function(g,k){var j=k+"."+e;if(j.indexOf(".")===0){d.d.push(j);d.w.push(j)}else d[b.test(k)?"w":"d"].push(j)});d.d=d.d.join(" ");d.w=d.w.join(" ");return d}var b=
/^((after|before)print|(before)?unload|hashchange|message|o(ff|n)line|page(hide|show)|popstate|resize|storage)\b/;mejs.MediaElementPlayer.prototype.globalBind=function(c,e,d){c=a(c,this.id);c.d&&f(document).bind(c.d,e,d);c.w&&f(window).bind(c.w,e,d)};mejs.MediaElementPlayer.prototype.globalUnbind=function(c,e){c=a(c,this.id);c.d&&f(document).unbind(c.d,e);c.w&&f(window).unbind(c.w,e)}})();if(typeof jQuery!="undefined")jQuery.fn.mediaelementplayer=function(a){a===false?this.each(function(){var b=jQuery(this).data("mediaelementplayer");
b&&b.remove();jQuery(this).removeData("mediaelementplayer")}):this.each(function(){jQuery(this).data("mediaelementplayer",new mejs.MediaElementPlayer(this,a))});return this};f(document).ready(function(){f(".mejs-player").mediaelementplayer()});window.MediaElementPlayer=mejs.MediaElementPlayer})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{playpauseText:mejs.i18n.t("Play/Pause")});f.extend(MediaElementPlayer.prototype,{buildplaypause:function(a,b,c,e){var d=f('<div class="mejs-button mejs-playpause-button mejs-play" ><button type="button" aria-controls="'+this.id+'" title="'+this.options.playpauseText+'" aria-label="'+this.options.playpauseText+'"></button></div>').appendTo(b).click(function(g){g.preventDefault();e.paused?e.play():e.pause();return false});e.addEventListener("play",function(){d.removeClass("mejs-play").addClass("mejs-pause")},
false);e.addEventListener("playing",function(){d.removeClass("mejs-play").addClass("mejs-pause")},false);e.addEventListener("pause",function(){d.removeClass("mejs-pause").addClass("mejs-play")},false);e.addEventListener("paused",function(){d.removeClass("mejs-pause").addClass("mejs-play")},false)}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{stopText:"Stop"});f.extend(MediaElementPlayer.prototype,{buildstop:function(a,b,c,e){f('<div class="mejs-button mejs-stop-button mejs-stop"><button type="button" aria-controls="'+this.id+'" title="'+this.options.stopText+'" aria-label="'+this.options.stopText+'"></button></div>').appendTo(b).click(function(){e.paused||e.pause();if(e.currentTime>0){e.setCurrentTime(0);e.pause();b.find(".mejs-time-current").width("0px");b.find(".mejs-time-handle").css("left",
"0px");b.find(".mejs-time-float-current").html(mejs.Utility.secondsToTimeCode(0));b.find(".mejs-currenttime").html(mejs.Utility.secondsToTimeCode(0));c.find(".mejs-poster").show()}})}})})(mejs.$);
(function(f){f.extend(MediaElementPlayer.prototype,{buildprogress:function(a,b,c,e){f('<div class="mejs-time-rail"><span class="mejs-time-total"><span class="mejs-time-buffering"></span><span class="mejs-time-loaded"></span><span class="mejs-time-current"></span><span class="mejs-time-handle"></span><span class="mejs-time-float"><span class="mejs-time-float-current">00:00</span><span class="mejs-time-float-corner"></span></span></span></div>').appendTo(b);b.find(".mejs-time-buffering").hide();var d=
this,g=b.find(".mejs-time-total");c=b.find(".mejs-time-loaded");var k=b.find(".mejs-time-current"),j=b.find(".mejs-time-handle"),m=b.find(".mejs-time-float"),q=b.find(".mejs-time-float-current"),p=function(h){h=h.pageX;var l=g.offset(),r=g.outerWidth(true),n=0,o=n=0;if(e.duration){if(h<l.left)h=l.left;else if(h>r+l.left)h=r+l.left;o=h-l.left;n=o/r;n=n<=0.02?0:n*e.duration;t&&n!==e.currentTime&&e.setCurrentTime(n);if(!mejs.MediaFeatures.hasTouch){m.css("left",o);q.html(mejs.Utility.secondsToTimeCode(n));
m.show()}}},t=false;g.bind("mousedown",function(h){if(h.which===1){t=true;p(h);d.globalBind("mousemove.dur",function(l){p(l)});d.globalBind("mouseup.dur",function(){t=false;m.hide();d.globalUnbind(".dur")});return false}}).bind("mouseenter",function(){d.globalBind("mousemove.dur",function(h){p(h)});mejs.MediaFeatures.hasTouch||m.show()}).bind("mouseleave",function(){if(!t){d.globalUnbind(".dur");m.hide()}});e.addEventListener("progress",function(h){a.setProgressRail(h);a.setCurrentRail(h)},false);
e.addEventListener("timeupdate",function(h){a.setProgressRail(h);a.setCurrentRail(h)},false);d.loaded=c;d.total=g;d.current=k;d.handle=j},setProgressRail:function(a){var b=a!=undefined?a.target:this.media,c=null;if(b&&b.buffered&&b.buffered.length>0&&b.buffered.end&&b.duration)c=b.buffered.end(0)/b.duration;else if(b&&b.bytesTotal!=undefined&&b.bytesTotal>0&&b.bufferedBytes!=undefined)c=b.bufferedBytes/b.bytesTotal;else if(a&&a.lengthComputable&&a.total!=0)c=a.loaded/a.total;if(c!==null){c=Math.min(1,
Math.max(0,c));this.loaded&&this.total&&this.loaded.width(this.total.width()*c)}},setCurrentRail:function(){if(this.media.currentTime!=undefined&&this.media.duration)if(this.total&&this.handle){var a=Math.round(this.total.width()*this.media.currentTime/this.media.duration),b=a-Math.round(this.handle.outerWidth(true)/2);this.current.width(a);this.handle.css("left",b)}}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{duration:-1,timeAndDurationSeparator:"<span> | </span>"});f.extend(MediaElementPlayer.prototype,{buildcurrent:function(a,b,c,e){f('<div class="mejs-time"><span class="mejs-currenttime">'+(a.options.alwaysShowHours?"00:":"")+(a.options.showTimecodeFrameCount?"00:00:00":"00:00")+"</span></div>").appendTo(b);this.currenttime=this.controls.find(".mejs-currenttime");e.addEventListener("timeupdate",function(){a.updateCurrent()},false)},buildduration:function(a,b,
c,e){if(b.children().last().find(".mejs-currenttime").length>0)f(this.options.timeAndDurationSeparator+'<span class="mejs-duration">'+(this.options.duration>0?mejs.Utility.secondsToTimeCode(this.options.duration,this.options.alwaysShowHours||this.media.duration>3600,this.options.showTimecodeFrameCount,this.options.framesPerSecond||25):(a.options.alwaysShowHours?"00:":"")+(a.options.showTimecodeFrameCount?"00:00:00":"00:00"))+"</span>").appendTo(b.find(".mejs-time"));else{b.find(".mejs-currenttime").parent().addClass("mejs-currenttime-container");
f('<div class="mejs-time mejs-duration-container"><span class="mejs-duration">'+(this.options.duration>0?mejs.Utility.secondsToTimeCode(this.options.duration,this.options.alwaysShowHours||this.media.duration>3600,this.options.showTimecodeFrameCount,this.options.framesPerSecond||25):(a.options.alwaysShowHours?"00:":"")+(a.options.showTimecodeFrameCount?"00:00:00":"00:00"))+"</span></div>").appendTo(b)}this.durationD=this.controls.find(".mejs-duration");e.addEventListener("timeupdate",function(){a.updateDuration()},
false)},updateCurrent:function(){if(this.currenttime)this.currenttime.html(mejs.Utility.secondsToTimeCode(this.media.currentTime,this.options.alwaysShowHours||this.media.duration>3600,this.options.showTimecodeFrameCount,this.options.framesPerSecond||25))},updateDuration:function(){this.container.toggleClass("mejs-long-video",this.media.duration>3600);if(this.durationD&&(this.options.duration>0||this.media.duration))this.durationD.html(mejs.Utility.secondsToTimeCode(this.options.duration>0?this.options.duration:
this.media.duration,this.options.alwaysShowHours,this.options.showTimecodeFrameCount,this.options.framesPerSecond||25))}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{muteText:mejs.i18n.t("Mute Toggle"),hideVolumeOnTouchDevices:true,audioVolume:"horizontal",videoVolume:"vertical"});f.extend(MediaElementPlayer.prototype,{buildvolume:function(a,b,c,e){if(!(mejs.MediaFeatures.hasTouch&&this.options.hideVolumeOnTouchDevices)){var d=this,g=d.isVideo?d.options.videoVolume:d.options.audioVolume,k=g=="horizontal"?f('<div class="mejs-button mejs-volume-button mejs-mute"><button type="button" aria-controls="'+d.id+'" title="'+d.options.muteText+
'" aria-label="'+d.options.muteText+'"></button></div><div class="mejs-horizontal-volume-slider"><div class="mejs-horizontal-volume-total"></div><div class="mejs-horizontal-volume-current"></div><div class="mejs-horizontal-volume-handle"></div></div>').appendTo(b):f('<div class="mejs-button mejs-volume-button mejs-mute"><button type="button" aria-controls="'+d.id+'" title="'+d.options.muteText+'" aria-label="'+d.options.muteText+'"></button><div class="mejs-volume-slider"><div class="mejs-volume-total"></div><div class="mejs-volume-current"></div><div class="mejs-volume-handle"></div></div></div>').appendTo(b),
j=d.container.find(".mejs-volume-slider, .mejs-horizontal-volume-slider"),m=d.container.find(".mejs-volume-total, .mejs-horizontal-volume-total"),q=d.container.find(".mejs-volume-current, .mejs-horizontal-volume-current"),p=d.container.find(".mejs-volume-handle, .mejs-horizontal-volume-handle"),t=function(n,o){if(!j.is(":visible")&&typeof o=="undefined"){j.show();t(n,true);j.hide()}else{n=Math.max(0,n);n=Math.min(n,1);n==0?k.removeClass("mejs-mute").addClass("mejs-unmute"):k.removeClass("mejs-unmute").addClass("mejs-mute");
if(g=="vertical"){var s=m.height(),u=m.position(),v=s-s*n;p.css("top",Math.round(u.top+v-p.height()/2));q.height(s-v);q.css("top",u.top+v)}else{s=m.width();u=m.position();s=s*n;p.css("left",Math.round(u.left+s-p.width()/2));q.width(Math.round(s))}}},h=function(n){var o=null,s=m.offset();if(g=="vertical"){o=m.height();parseInt(m.css("top").replace(/px/,""),10);o=(o-(n.pageY-s.top))/o;if(s.top==0||s.left==0)return}else{o=m.width();o=(n.pageX-s.left)/o}o=Math.max(0,o);o=Math.min(o,1);t(o);o==0?e.setMuted(true):
e.setMuted(false);e.setVolume(o)},l=false,r=false;k.hover(function(){j.show();r=true},function(){r=false;!l&&g=="vertical"&&j.hide()});j.bind("mouseover",function(){r=true}).bind("mousedown",function(n){h(n);d.globalBind("mousemove.vol",function(o){h(o)});d.globalBind("mouseup.vol",function(){l=false;d.globalUnbind(".vol");!r&&g=="vertical"&&j.hide()});l=true;return false});k.find("button").click(function(){e.setMuted(!e.muted)});e.addEventListener("volumechange",function(){if(!l)if(e.muted){t(0);
k.removeClass("mejs-mute").addClass("mejs-unmute")}else{t(e.volume);k.removeClass("mejs-unmute").addClass("mejs-mute")}},false);if(d.container.is(":visible")){t(a.options.startVolume);a.options.startVolume===0&&e.setMuted(true);e.pluginType==="native"&&e.setVolume(a.options.startVolume)}}}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{usePluginFullScreen:true,newWindowCallback:function(){return""},fullscreenText:mejs.i18n.t("Fullscreen")});f.extend(MediaElementPlayer.prototype,{isFullScreen:false,isNativeFullScreen:false,isInIframe:false,buildfullscreen:function(a,b,c,e){if(a.isVideo){a.isInIframe=window.location!=window.parent.location;if(mejs.MediaFeatures.hasTrueNativeFullScreen){c=function(){if(a.isFullScreen)if(mejs.MediaFeatures.isFullScreen()){a.isNativeFullScreen=true;a.setControlsSize()}else{a.isNativeFullScreen=
false;a.exitFullScreen()}};mejs.MediaFeatures.hasMozNativeFullScreen?a.globalBind(mejs.MediaFeatures.fullScreenEventName,c):a.container.bind(mejs.MediaFeatures.fullScreenEventName,c)}var d=this,g=f('<div class="mejs-button mejs-fullscreen-button"><button type="button" aria-controls="'+d.id+'" title="'+d.options.fullscreenText+'" aria-label="'+d.options.fullscreenText+'"></button></div>').appendTo(b);if(d.media.pluginType==="native"||!d.options.usePluginFullScreen&&!mejs.MediaFeatures.isFirefox)g.click(function(){mejs.MediaFeatures.hasTrueNativeFullScreen&&
mejs.MediaFeatures.isFullScreen()||a.isFullScreen?a.exitFullScreen():a.enterFullScreen()});else{var k=null;if(function(){var h=document.createElement("x"),l=document.documentElement,r=window.getComputedStyle;if(!("pointerEvents"in h.style))return false;h.style.pointerEvents="auto";h.style.pointerEvents="x";l.appendChild(h);r=r&&r(h,"").pointerEvents==="auto";l.removeChild(h);return!!r}()&&!mejs.MediaFeatures.isOpera){var j=false,m=function(){if(j){for(var h in q)q[h].hide();g.css("pointer-events",
"");d.controls.css("pointer-events","");d.media.removeEventListener("click",d.clickToPlayPauseCallback);j=false}},q={};b=["top","left","right","bottom"];var p,t=function(){var h=g.offset().left-d.container.offset().left,l=g.offset().top-d.container.offset().top,r=g.outerWidth(true),n=g.outerHeight(true),o=d.container.width(),s=d.container.height();for(p in q)q[p].css({position:"absolute",top:0,left:0});q.top.width(o).height(l);q.left.width(h).height(n).css({top:l});q.right.width(o-h-r).height(n).css({top:l,
left:h+r});q.bottom.width(o).height(s-n-l).css({top:l+n})};d.globalBind("resize",function(){t()});p=0;for(c=b.length;p<c;p++)q[b[p]]=f('<div class="mejs-fullscreen-hover" />').appendTo(d.container).mouseover(m).hide();g.on("mouseover",function(){if(!d.isFullScreen){var h=g.offset(),l=a.container.offset();e.positionFullscreenButton(h.left-l.left,h.top-l.top,false);g.css("pointer-events","none");d.controls.css("pointer-events","none");d.media.addEventListener("click",d.clickToPlayPauseCallback);for(p in q)q[p].show();
t();j=true}});e.addEventListener("fullscreenchange",function(){d.isFullScreen=!d.isFullScreen;d.isFullScreen?d.media.removeEventListener("click",d.clickToPlayPauseCallback):d.media.addEventListener("click",d.clickToPlayPauseCallback);m()});d.globalBind("mousemove",function(h){if(j){var l=g.offset();if(h.pageY<l.top||h.pageY>l.top+g.outerHeight(true)||h.pageX<l.left||h.pageX>l.left+g.outerWidth(true)){g.css("pointer-events","");d.controls.css("pointer-events","");j=false}}})}else g.on("mouseover",
function(){if(k!==null){clearTimeout(k);delete k}var h=g.offset(),l=a.container.offset();e.positionFullscreenButton(h.left-l.left,h.top-l.top,true)}).on("mouseout",function(){if(k!==null){clearTimeout(k);delete k}k=setTimeout(function(){e.hideFullscreenButton()},1500)})}a.fullscreenBtn=g;d.globalBind("keydown",function(h){if((mejs.MediaFeatures.hasTrueNativeFullScreen&&mejs.MediaFeatures.isFullScreen()||d.isFullScreen)&&h.keyCode==27)a.exitFullScreen()})}},cleanfullscreen:function(a){a.exitFullScreen()},
containerSizeTimeout:null,enterFullScreen:function(){var a=this;if(!(a.media.pluginType!=="native"&&(mejs.MediaFeatures.isFirefox||a.options.usePluginFullScreen))){f(document.documentElement).addClass("mejs-fullscreen");normalHeight=a.container.height();normalWidth=a.container.width();if(a.media.pluginType==="native")if(mejs.MediaFeatures.hasTrueNativeFullScreen){mejs.MediaFeatures.requestFullScreen(a.container[0]);a.isInIframe&&setTimeout(function c(){if(a.isNativeFullScreen)f(window).width()!==
screen.width?a.exitFullScreen():setTimeout(c,500)},500)}else if(mejs.MediaFeatures.hasSemiNativeFullScreen){a.media.webkitEnterFullscreen();return}if(a.isInIframe){var b=a.options.newWindowCallback(this);if(b!=="")if(mejs.MediaFeatures.hasTrueNativeFullScreen)setTimeout(function(){if(!a.isNativeFullScreen){a.pause();window.open(b,a.id,"top=0,left=0,width="+screen.availWidth+",height="+screen.availHeight+",resizable=yes,scrollbars=no,status=no,toolbar=no")}},250);else{a.pause();window.open(b,a.id,
"top=0,left=0,width="+screen.availWidth+",height="+screen.availHeight+",resizable=yes,scrollbars=no,status=no,toolbar=no");return}}a.container.addClass("mejs-container-fullscreen").width("100%").height("100%");a.containerSizeTimeout=setTimeout(function(){a.container.css({width:"100%",height:"100%"});a.setControlsSize()},500);if(a.media.pluginType==="native")a.$media.width("100%").height("100%");else{a.container.find(".mejs-shim").width("100%").height("100%");a.media.setVideoSize(f(window).width(),
f(window).height())}a.layers.children("div").width("100%").height("100%");a.fullscreenBtn&&a.fullscreenBtn.removeClass("mejs-fullscreen").addClass("mejs-unfullscreen");a.setControlsSize();a.isFullScreen=true}},exitFullScreen:function(){clearTimeout(this.containerSizeTimeout);if(this.media.pluginType!=="native"&&mejs.MediaFeatures.isFirefox)this.media.setFullscreen(false);else{if(mejs.MediaFeatures.hasTrueNativeFullScreen&&(mejs.MediaFeatures.isFullScreen()||this.isFullScreen))mejs.MediaFeatures.cancelFullScreen();
f(document.documentElement).removeClass("mejs-fullscreen");this.container.removeClass("mejs-container-fullscreen").width(normalWidth).height(normalHeight);if(this.media.pluginType==="native")this.$media.width(normalWidth).height(normalHeight);else{this.container.find(".mejs-shim").width(normalWidth).height(normalHeight);this.media.setVideoSize(normalWidth,normalHeight)}this.layers.children("div").width(normalWidth).height(normalHeight);this.fullscreenBtn.removeClass("mejs-unfullscreen").addClass("mejs-fullscreen");
this.setControlsSize();this.isFullScreen=false}}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{startLanguage:"",tracksText:mejs.i18n.t("Captions/Subtitles"),hideCaptionsButtonWhenEmpty:true,toggleCaptionsButtonWhenOnlyOne:false,slidesSelector:""});f.extend(MediaElementPlayer.prototype,{hasChapters:false,buildtracks:function(a,b,c,e){if(a.tracks.length!=0){var d;if(this.domNode.textTracks)for(d=this.domNode.textTracks.length-1;d>=0;d--)this.domNode.textTracks[d].mode="hidden";a.chapters=f('<div class="mejs-chapters mejs-layer"></div>').prependTo(c).hide();a.captions=
f('<div class="mejs-captions-layer mejs-layer"><div class="mejs-captions-position mejs-captions-position-hover"><span class="mejs-captions-text"></span></div></div>').prependTo(c).hide();a.captionsText=a.captions.find(".mejs-captions-text");a.captionsButton=f('<div class="mejs-button mejs-captions-button"><button type="button" aria-controls="'+this.id+'" title="'+this.options.tracksText+'" aria-label="'+this.options.tracksText+'"></button><div class="mejs-captions-selector"><ul><li><input type="radio" name="'+
a.id+'_captions" id="'+a.id+'_captions_none" value="none" checked="checked" /><label for="'+a.id+'_captions_none">'+mejs.i18n.t("None")+"</label></li></ul></div></div>").appendTo(b);for(d=b=0;d<a.tracks.length;d++)a.tracks[d].kind=="subtitles"&&b++;this.options.toggleCaptionsButtonWhenOnlyOne&&b==1?a.captionsButton.on("click",function(){a.setTrack(a.selectedTrack==null?a.tracks[0].srclang:"none")}):a.captionsButton.hover(function(){f(this).find(".mejs-captions-selector").css("visibility","visible")},
function(){f(this).find(".mejs-captions-selector").css("visibility","hidden")}).on("click","input[type=radio]",function(){lang=this.value;a.setTrack(lang)});a.options.alwaysShowControls?a.container.find(".mejs-captions-position").addClass("mejs-captions-position-hover"):a.container.bind("controlsshown",function(){a.container.find(".mejs-captions-position").addClass("mejs-captions-position-hover")}).bind("controlshidden",function(){e.paused||a.container.find(".mejs-captions-position").removeClass("mejs-captions-position-hover")});
a.trackToLoad=-1;a.selectedTrack=null;a.isLoadingTrack=false;for(d=0;d<a.tracks.length;d++)a.tracks[d].kind=="subtitles"&&a.addTrackButton(a.tracks[d].srclang,a.tracks[d].label);a.loadNextTrack();e.addEventListener("timeupdate",function(){a.displayCaptions()},false);if(a.options.slidesSelector!=""){a.slidesContainer=f(a.options.slidesSelector);e.addEventListener("timeupdate",function(){a.displaySlides()},false)}e.addEventListener("loadedmetadata",function(){a.displayChapters()},false);a.container.hover(function(){if(a.hasChapters){a.chapters.css("visibility",
"visible");a.chapters.fadeIn(200).height(a.chapters.find(".mejs-chapter").outerHeight())}},function(){a.hasChapters&&!e.paused&&a.chapters.fadeOut(200,function(){f(this).css("visibility","hidden");f(this).css("display","block")})});a.node.getAttribute("autoplay")!==null&&a.chapters.css("visibility","hidden")}},setTrack:function(a){var b;if(a=="none"){this.selectedTrack=null;this.captionsButton.removeClass("mejs-captions-enabled")}else for(b=0;b<this.tracks.length;b++)if(this.tracks[b].srclang==a){this.selectedTrack==
null&&this.captionsButton.addClass("mejs-captions-enabled");this.selectedTrack=this.tracks[b];this.captions.attr("lang",this.selectedTrack.srclang);this.displayCaptions();break}},loadNextTrack:function(){this.trackToLoad++;if(this.trackToLoad<this.tracks.length){this.isLoadingTrack=true;this.loadTrack(this.trackToLoad)}else{this.isLoadingTrack=false;this.checkForTracks()}},loadTrack:function(a){var b=this,c=b.tracks[a];f.ajax({url:c.src,dataType:"text",success:function(e){c.entries=typeof e=="string"&&
/<tt\s+xml/ig.exec(e)?mejs.TrackFormatParser.dfxp.parse(e):mejs.TrackFormatParser.webvvt.parse(e);c.isLoaded=true;b.enableTrackButton(c.srclang,c.label);b.loadNextTrack();c.kind=="chapters"&&b.media.addEventListener("play",function(){b.media.duration>0&&b.displayChapters(c)},false);c.kind=="slides"&&b.setupSlides(c)},error:function(){b.loadNextTrack()}})},enableTrackButton:function(a,b){if(b==="")b=mejs.language.codes[a]||a;this.captionsButton.find("input[value="+a+"]").prop("disabled",false).siblings("label").html(b);
this.options.startLanguage==a&&f("#"+this.id+"_captions_"+a).click();this.adjustLanguageBox()},addTrackButton:function(a,b){if(b==="")b=mejs.language.codes[a]||a;this.captionsButton.find("ul").append(f('<li><input type="radio" name="'+this.id+'_captions" id="'+this.id+"_captions_"+a+'" value="'+a+'" disabled="disabled" /><label for="'+this.id+"_captions_"+a+'">'+b+" (loading)</label></li>"));this.adjustLanguageBox();this.container.find(".mejs-captions-translations option[value="+a+"]").remove()},
adjustLanguageBox:function(){this.captionsButton.find(".mejs-captions-selector").height(this.captionsButton.find(".mejs-captions-selector ul").outerHeight(true)+this.captionsButton.find(".mejs-captions-translations").outerHeight(true))},checkForTracks:function(){var a=false;if(this.options.hideCaptionsButtonWhenEmpty){for(i=0;i<this.tracks.length;i++)if(this.tracks[i].kind=="subtitles"){a=true;break}if(!a){this.captionsButton.hide();this.setControlsSize()}}},displayCaptions:function(){if(typeof this.tracks!=
"undefined"){var a,b=this.selectedTrack;if(b!=null&&b.isLoaded)for(a=0;a<b.entries.times.length;a++)if(this.media.currentTime>=b.entries.times[a].start&&this.media.currentTime<=b.entries.times[a].stop){this.captionsText.html(b.entries.text[a]);this.captions.show().height(0);return}this.captions.hide()}},setupSlides:function(a){this.slides=a;this.slides.entries.imgs=[this.slides.entries.text.length];this.showSlide(0)},showSlide:function(a){if(!(typeof this.tracks=="undefined"||typeof this.slidesContainer==
"undefined")){var b=this,c=b.slides.entries.text[a],e=b.slides.entries.imgs[a];if(typeof e=="undefined"||typeof e.fadeIn=="undefined")b.slides.entries.imgs[a]=e=f('<img src="'+c+'">').on("load",function(){e.appendTo(b.slidesContainer).hide().fadeIn().siblings(":visible").fadeOut()});else!e.is(":visible")&&!e.is(":animated")&&e.fadeIn().siblings(":visible").fadeOut()}},displaySlides:function(){if(typeof this.slides!="undefined"){var a=this.slides,b;for(b=0;b<a.entries.times.length;b++)if(this.media.currentTime>=
a.entries.times[b].start&&this.media.currentTime<=a.entries.times[b].stop){this.showSlide(b);break}}},displayChapters:function(){var a;for(a=0;a<this.tracks.length;a++)if(this.tracks[a].kind=="chapters"&&this.tracks[a].isLoaded){this.drawChapters(this.tracks[a]);this.hasChapters=true;break}},drawChapters:function(a){var b=this,c,e,d=e=0;b.chapters.empty();for(c=0;c<a.entries.times.length;c++){e=a.entries.times[c].stop-a.entries.times[c].start;e=Math.floor(e/b.media.duration*100);if(e+d>100||c==a.entries.times.length-
1&&e+d<100)e=100-d;b.chapters.append(f('<div class="mejs-chapter" rel="'+a.entries.times[c].start+'" style="left: '+d.toString()+"%;width: "+e.toString()+'%;"><div class="mejs-chapter-block'+(c==a.entries.times.length-1?" mejs-chapter-block-last":"")+'"><span class="ch-title">'+a.entries.text[c]+'</span><span class="ch-time">'+mejs.Utility.secondsToTimeCode(a.entries.times[c].start)+"&ndash;"+mejs.Utility.secondsToTimeCode(a.entries.times[c].stop)+"</span></div></div>"));d+=e}b.chapters.find("div.mejs-chapter").click(function(){b.media.setCurrentTime(parseFloat(f(this).attr("rel")));
b.media.paused&&b.media.play()});b.chapters.show()}});mejs.language={codes:{af:"Afrikaans",sq:"Albanian",ar:"Arabic",be:"Belarusian",bg:"Bulgarian",ca:"Catalan",zh:"Chinese","zh-cn":"Chinese Simplified","zh-tw":"Chinese Traditional",hr:"Croatian",cs:"Czech",da:"Danish",nl:"Dutch",en:"English",et:"Estonian",tl:"Filipino",fi:"Finnish",fr:"French",gl:"Galician",de:"German",el:"Greek",ht:"Haitian Creole",iw:"Hebrew",hi:"Hindi",hu:"Hungarian",is:"Icelandic",id:"Indonesian",ga:"Irish",it:"Italian",ja:"Japanese",
ko:"Korean",lv:"Latvian",lt:"Lithuanian",mk:"Macedonian",ms:"Malay",mt:"Maltese",no:"Norwegian",fa:"Persian",pl:"Polish",pt:"Portuguese",ro:"Romanian",ru:"Russian",sr:"Serbian",sk:"Slovak",sl:"Slovenian",es:"Spanish",sw:"Swahili",sv:"Swedish",tl:"Tagalog",th:"Thai",tr:"Turkish",uk:"Ukrainian",vi:"Vietnamese",cy:"Welsh",yi:"Yiddish"}};mejs.TrackFormatParser={webvvt:{pattern_identifier:/^([a-zA-z]+-)?[0-9]+$/,pattern_timecode:/^([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{1,3})?) --\> ([0-9]{2}:[0-9]{2}:[0-9]{2}([,.][0-9]{3})?)(.*)$/,
parse:function(a){var b=0;a=mejs.TrackFormatParser.split2(a,/\r?\n/);for(var c={text:[],times:[]},e,d;b<a.length;b++)if(this.pattern_identifier.exec(a[b])){b++;if((e=this.pattern_timecode.exec(a[b]))&&b<a.length){b++;d=a[b];for(b++;a[b]!==""&&b<a.length;){d=d+"\n"+a[b];b++}d=f.trim(d).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href='$1' target='_blank'>$1</a>");c.text.push(d);c.times.push({start:mejs.Utility.convertSMPTEtoSeconds(e[1])==0?0.2:mejs.Utility.convertSMPTEtoSeconds(e[1]),
stop:mejs.Utility.convertSMPTEtoSeconds(e[3]),settings:e[5]})}}return c}},dfxp:{parse:function(a){a=f(a).filter("tt");var b=0;b=a.children("div").eq(0);var c=b.find("p");b=a.find("#"+b.attr("style"));var e,d;a={text:[],times:[]};if(b.length){d=b.removeAttr("id").get(0).attributes;if(d.length){e={};for(b=0;b<d.length;b++)e[d[b].name.split(":")[1]]=d[b].value}}for(b=0;b<c.length;b++){var g;d={start:null,stop:null,style:null};if(c.eq(b).attr("begin"))d.start=mejs.Utility.convertSMPTEtoSeconds(c.eq(b).attr("begin"));
if(!d.start&&c.eq(b-1).attr("end"))d.start=mejs.Utility.convertSMPTEtoSeconds(c.eq(b-1).attr("end"));if(c.eq(b).attr("end"))d.stop=mejs.Utility.convertSMPTEtoSeconds(c.eq(b).attr("end"));if(!d.stop&&c.eq(b+1).attr("begin"))d.stop=mejs.Utility.convertSMPTEtoSeconds(c.eq(b+1).attr("begin"));if(e){g="";for(var k in e)g+=k+":"+e[k]+";"}if(g)d.style=g;if(d.start==0)d.start=0.2;a.times.push(d);d=f.trim(c.eq(b).html()).replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,
"<a href='$1' target='_blank'>$1</a>");a.text.push(d);if(a.times.start==0)a.times.start=2}return a}},split2:function(a,b){return a.split(b)}};if("x\n\ny".split(/\n/gi).length!=3)mejs.TrackFormatParser.split2=function(a,b){var c=[],e="",d;for(d=0;d<a.length;d++){e+=a.substring(d,d+1);if(b.test(e)){c.push(e.replace(b,""));e=""}}c.push(e);return c}})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{contextMenuItems:[{render:function(a){if(typeof a.enterFullScreen=="undefined")return null;return a.isFullScreen?mejs.i18n.t("Turn off Fullscreen"):mejs.i18n.t("Go Fullscreen")},click:function(a){a.isFullScreen?a.exitFullScreen():a.enterFullScreen()}},{render:function(a){return a.media.muted?mejs.i18n.t("Unmute"):mejs.i18n.t("Mute")},click:function(a){a.media.muted?a.setMuted(false):a.setMuted(true)}},{isSeparator:true},{render:function(){return mejs.i18n.t("Download Video")},
click:function(a){window.location.href=a.media.currentSrc}}]});f.extend(MediaElementPlayer.prototype,{buildcontextmenu:function(a){a.contextMenu=f('<div class="mejs-contextmenu"></div>').appendTo(f("body")).hide();a.container.bind("contextmenu",function(b){if(a.isContextMenuEnabled){b.preventDefault();a.renderContextMenu(b.clientX-1,b.clientY-1);return false}});a.container.bind("click",function(){a.contextMenu.hide()});a.contextMenu.bind("mouseleave",function(){a.startContextMenuTimer()})},cleancontextmenu:function(a){a.contextMenu.remove()},
isContextMenuEnabled:true,enableContextMenu:function(){this.isContextMenuEnabled=true},disableContextMenu:function(){this.isContextMenuEnabled=false},contextMenuTimeout:null,startContextMenuTimer:function(){var a=this;a.killContextMenuTimer();a.contextMenuTimer=setTimeout(function(){a.hideContextMenu();a.killContextMenuTimer()},750)},killContextMenuTimer:function(){var a=this.contextMenuTimer;if(a!=null){clearTimeout(a);delete a}},hideContextMenu:function(){this.contextMenu.hide()},renderContextMenu:function(a,
b){for(var c=this,e="",d=c.options.contextMenuItems,g=0,k=d.length;g<k;g++)if(d[g].isSeparator)e+='<div class="mejs-contextmenu-separator"></div>';else{var j=d[g].render(c);if(j!=null)e+='<div class="mejs-contextmenu-item" data-itemindex="'+g+'" id="element-'+Math.random()*1E6+'">'+j+"</div>"}c.contextMenu.empty().append(f(e)).css({top:b,left:a}).show();c.contextMenu.find(".mejs-contextmenu-item").each(function(){var m=f(this),q=parseInt(m.data("itemindex"),10),p=c.options.contextMenuItems[q];typeof p.show!=
"undefined"&&p.show(m,c);m.click(function(){typeof p.click!="undefined"&&p.click(c);c.contextMenu.hide()})});setTimeout(function(){c.killControlsTimer("rev3")},100)}})})(mejs.$);
(function(f){f.extend(mejs.MepDefaults,{postrollCloseText:mejs.i18n.t("Close")});f.extend(MediaElementPlayer.prototype,{buildpostroll:function(a,b,c){var e=this.container.find('link[rel="postroll"]').attr("href");if(typeof e!=="undefined"){a.postroll=f('<div class="mejs-postroll-layer mejs-layer"><a class="mejs-postroll-close" onclick="$(this).parent().hide();return false;">'+this.options.postrollCloseText+'</a><div class="mejs-postroll-layer-content"></div></div>').prependTo(c).hide();this.media.addEventListener("ended",
function(){f.ajax({dataType:"html",url:e,success:function(d){c.find(".mejs-postroll-layer-content").html(d)}});a.postroll.show()},false)}}})})(mejs.$);


define("extensions/adapt-editorial/js/lib/mediaelement-and-player.min", function(){});

define('extensions/adapt-editorial/js/tiles/e-video',[
    'coreJS/adapt',
    './media',
    '../lib/mediaelement-and-player.min'
], function(Adapt, MediaTile) {

    var VideoTile = {
        
        View: MediaTile.View.extend({

            events: {
                "click .media-inline-transcript-button": "onToggleInlineTranscript",
                "mouseover": "onMouseOver",
                "mouseout": "onMouseOut"
            },

            _mouseOn: false,
            _blockFade: false,
            _isTouch: false,
            _isPlaying: false,
            _forceResize: true,

            onInitialize: Backbone.ascend("onInitialize", function() {
                this.onPause();
                this._isTouch = Modernizr.touch;
                this._onFadeInOut = _.debounce(_.bind(this.onFadeInOut, this), 100);
                this._unblockFade = _.bind(this.unblockFade, this);
                this._onWindowResize = _.bind(this.onWindowResize, this);
                $(window).on("resize", this._onWindowResize);
                this.listenTo(Adapt, 'accessibility:toggle', this.onAccessibilityToggle);
            }),

            onMouseOver: function(event) {
                if (this._isTouch) return;
                if (this._mouseOn) return;
                this._onFadeInOut();
                this._mouseOn = true;
            },

            onMouseOut: function(event) {
                if (this._isTouch) return;
                if (!this._mouseOn) return;
                this._onFadeInOut();
                this._mouseOn = false;
            },

            onFadeInOut: function() {
                if (!this.model.get("_textOverlay")) return;
                if (this._blockFade) return;
                if (this._mouseOn) {
                    this.$(".text").velocity("stop").velocity({opacity:.5}, {duration:250});
                } else {
                    this.$(".text").velocity("stop").velocity({opacity:1}, {duration:250});
                }
            },

            unblockFade: function() {
                this._blockFade = false;
                this._onFadeInOut();            
            },

            onPlay: function() {
                this.$el.attr("playing", true);
                this._isPlaying = true;

                this.toggleText();
            },

            onPause: function() {
                this.$el.attr("playing", false);
                this._isPlaying = false;

                this.toggleText();
            },

            toggleText: function() {
                if (!this.model.get("_textOverlay")) {
                    this.resetText();
                    return;
                };
                this._blockFade = true;
                if (this._isPlaying) {
                    switch (this.model.get("_textPosition")) {
                    case "left":
                        this.$(".text.top").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, left: -this.$(".text.top").width()+"px"}, { complete: this._unblockFade});
                        break;
                    case "top":
                        this.$(".text.top").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, top: -this.$(".text.top").height()+"px"}, { complete: this._unblockFade});
                        break;
                    case "right":
                        this.$(".text.bottom").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, right: -this.$(".text.top").width()+"px"}, { complete: this._unblockFade});
                        break;
                    case "bottom":
                        this.$(".text.bottom").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, bottom: -this.$(".text.top").height()+"px"}, { complete: this._unblockFade});
                    }
                } else {
                    switch (this.model.get("_textPosition")) {
                    case "left":
                        this.$(".text.top").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, left: 0+"px"}, { complete: this._unblockFade })
                        break;
                    case "top":
                        this.$(".text.top").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, top: 0+"px"}, { complete: this._unblockFade })
                        break;
                    case "right":
                        this.$(".text.bottom").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, right: 0+"px"}, { complete: this._unblockFade })
                        break;
                    case "bottom":
                        this.$(".text.bottom").velocity("stop").velocity({ opacity: this._mouseOn ? .5 : 1, bottom: 0+"px"}, { complete: this._unblockFade })
                        break;
                    }
                }
            },

            resetText: function() {
                this.$(".text").css({
                    top: "",
                    left: "",
                    right: "",
                    bottom: "",
                });
            },

            postRender: Backbone.ascend("postRender", function() {
                this.setupPlayer();
            }),

            setupPlayer: function() {
                if(!this.model.get('_playerOptions')) this.model.set('_playerOptions', {});

                var modelOptions = this.model.get('_playerOptions');

                if(modelOptions.pluginPath === undefined) modelOptions.pluginPath = 'assets/';
                if(modelOptions.features === undefined) modelOptions.features = ['playpause','progress','current','duration'];
                if(modelOptions.clickToPlayPause === undefined) modelOptions.clickToPlayPause = true;
                modelOptions.success = _.bind(this.onPlayerReady, this);

                var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                    ? true
                    : false;
                    
                if (hasAccessibility) modelOptions.alwaysShowControls = true;

                // create the player
                this.$('audio, video').mediaelementplayer(modelOptions);

                // We're streaming - set ready now, as success won't be called above
                if (this.model.get('_media').source) {
                    this.$('.media-widget').addClass('external-source');
                    this.setReadyStatus();
                }
            },

            // Overrides the default play/pause functionality to stop accidental playing on touch devices
            setupPlayPauseToggle: function() {
                // bit sneaky, but we don't have a this.mediaElement.player ref on iOS devices
                var player = this.mediaElement.player;

                if(!player) {
                    console.log("Media.setupPlayPauseToggle: OOPS! there's no player reference.");
                    return;
                }

                // stop the player dealing with this, we'll do it ourselves
                player.options.clickToPlayPause = false;

                // play on 'big button' click
                $('.mejs-overlay-button',this.$el).click(_.bind(function(event) {
                    player.play();
                }, this));

                // pause on player click
                $('.mejs-mediaelement',this.$el).click(_.bind(function(event) {
                    var isPaused = player.media.paused;
                    if(!isPaused) player.pause();
                }, this));
            },

            onRemove: Backbone.descend("onRemove", function() {
                if ($("html").is(".ie8")) {
                    var obj = this.$("object")[0];
                    if(obj) {
                        obj.style.display = "none";
                    }
                }
                if(this.mediaElement) {
                    $(this.mediaElement.pluginElement).remove();
                    delete this.mediaElement;
                }
                if (this._onWindowResize) {
                     $(window).on("resize", this._onWindowResize);
                     delete this._onWindowResize;
                }
            }),

            onPlayerReady: function (mediaElement, domObject) {
                this.mediaElement = mediaElement;

                if (!this.mediaElement.player) {
                    this.mediaElement.player =  mejs.players[$('.mejs-container').attr('id')];
                }

                $(this.mediaElement).on("play", _.bind(this.onPlay, this));
                $(this.mediaElement).on("pause", _.bind(this.onPause, this))

                this.showControls();

                var hasTouch = mejs.MediaFeatures.hasTouch;
                if(hasTouch) {
                    this.setupPlayPauseToggle();
                }

                this.setReadyStatus();
            },

            onAccessibilityToggle: function() {
               this.showControls();
            },

            onToggleInlineTranscript: function(event) {
                if (event) event.preventDefault();
                var $transcriptBodyContainer = $(".media-inline-transcript-body-container");
                var $button = $(".media-inline-transcript-button");

                if  ($transcriptBodyContainer.hasClass("inline-transcript-open")) {
                    $transcriptBodyContainer.slideUp();
                    $transcriptBodyContainer.removeClass("inline-transcript-open");
                    $button.html(this.model.get("_transcript").inlineTranscriptButton);
                } else {
                    $transcriptBodyContainer.slideDown().a11y_focus();
                    $transcriptBodyContainer.addClass("inline-transcript-open");
                    $button.html(this.model.get("_transcript").inlineTranscriptCloseButton);
                }
            },

            showControls: function() {
                var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                    ? true
                    : false;
                    
                if (hasAccessibility) {
                    if (!this.mediaElement.player) return;

                    var player = this.mediaElement.player;

                    player.options.alwaysShowControls = true;
                    player.enableControls();
                    player.showControls();

                    this.$('.mejs-playpause-button button').attr({
                        "role": "button"
                    });
                    var screenReaderVideoTagFix = $("<div role='region' aria-label='.'>");
                    this.$('.mejs-playpause-button').prepend(screenReaderVideoTagFix);

                    this.$('.mejs-time, .mejs-time-rail').attr({
                        "aria-hidden": "true"
                    });
                }
            },

            onResize: Backbone.ascend("onResize", function() {
                
                this.toggleText();

                this._forceResize = true;
                $(window).resize();
            }),

            getCalculatedStyleObject: Backbone.ascend("getCalculatedStyleObject", function() {
                var styleObject = this.model.toJSON();

                switch (styleObject._textPosition) {
                case "top": case "bottom":
                    styleObject._mediaRestrict = "100% auto";
                    styleObject._mediaPosition = "center top";
                }

                return styleObject;
            }),

            onWindowResize: function() {
                if (!$(window).haveDimensionsChanged() && !this._forceResize) return;
                this._forceResize = false;

                if (this.model.get('_media').source) {
                    this.$('.mejs-container').width(this.$('.component-widget').width());
                } else {
                    this.$('audio, video').width(this.$('.component-widget').width());
                    this.$('.mejs-container').width(this.$('.component-widget').width());
                }

                var styleObject = this.getCalculatedStyleObject();
                this.renderStyle(styleObject);
            }

        }),

        Model: MediaTile.Model.extend({
            defaults: Backbone.ascend("defaults", function() {
                return {
                    "#mediaRestrict": "100% 100%,100% 100%,100% 100%,100% 100%",
                    "#mediaSize": "100% auto,100% auto,100% auto,100% auto",
                    "#mediaDynamicRatio": "true,true,true,true"
                };
            })
        })
    };

    MediaTile.register('video', VideoTile);

    return VideoTile;

});

define('extensions/adapt-editorial/js/tiles/tiles',[
    './e-group',
    './e-text',
    './e-image',
    './e-video'
], function() {});
define('extensions/adapt-editorial/js/adapt-editorialArticleExtension',[
    'coreJS/adapt',
    'coreViews/articleView',
    'coreModels/articleModel',
    './adapt-editorialArticleView',
    './adapt-editorialArticleModel',
    './tiles/tiles'
], function(Adapt, ArticleView, ArticleModel, ExtensionView, ExtensionModel) {

    /*  
        Here we are extending the articleView and articleModel in Adapt.
        This is to accomodate the new functionality on the article.
        The advantage of this method is that the extension behaviour can utilize all of the predefined article behaviour in both the view and the model.
    */  

    //Extends core/js/views/articleView.js
    var ViewInitialize = ArticleView.prototype.initialize;
    ArticleView.prototype.initialize = function(options) {
        if (this.model.get("_editorial") && this.model.get("_editorial")._isEnabled && !this.model.get("_editorial")._isLightbox) {
            //extend the articleView with new functionality
            _.extend(this, ExtensionView);
        }
        //initialize the article in the normal manner
        return ViewInitialize.apply(this, arguments);
    };

    //Extends core/js/models/articleModel.js
    var ModelInitialize = ArticleModel.prototype.initialize;
    ArticleModel.prototype.initialize = function(options) {
        if (this.get("_editorial") && this.get("_editorial")._isEnabled && !this.get("_editorial")._isLightbox) {
            //extend the articleModel with new functionality
            _.extend(this, ExtensionModel);

            //initialize the article in the normal manner
            var returnValue = ModelInitialize.apply(this, arguments);

            //post initialize article extension
            ExtensionModel.postInitialize.call(this);

            return returnValue;
        }

        //initialize the article in the normal manner if no extension
        return ModelInitialize.apply(this, arguments);
    };

    

});
define('extensions/adapt-forceLoad/js/adapt-forceLoad',[ "coreJS/adapt" ], function(Adapt) {

	Adapt.once("app:dataReady", function() {
		if (!Adapt.config.get("_forceLoad")) return;

		$("<div/>")
			.addClass("force-load")
			.text("Force Load enabled")
			.appendTo($("#wrapper"));

		Adapt.on("menuView:postRender pageView:postRender", function(view) {
			_.defer(function() { view.model.setOnChildren({ _isReady: true }); });
		});
	});

});
define('extensions/adapt-hide-navigation-bar/js/adapt-hide-navigation-bar',[
    'coreJS/adapt'
], function(Adapt) {

    var $html = null;

	Adapt.on("router:menu router:page", function(model) {
        if (!$html) $html = $("html");

    	var shouldHideNavigationBar = model.get("_hideNavigationBar");
    	if (!shouldHideNavigationBar) showNavigationBar();
        else hideNavigationBar();

    });


    function hideNavigationBar() {
        $html.addClass("hide-navigation-bar");
    }

    function showNavigationBar() {
        $html.removeClass("hide-navigation-bar");
    }



});

define('extensions/adapt-inspector/js/adapt-inspector',[ "coreJS/adapt" ], function(Adapt) {

	var InspectorView = Backbone.View.extend({

		className: "inspector",

		ids: [],

		initialize: function() {
			this.listenTo(Adapt, {
				"inspector:id": this.pushId,
				"inspector:hover": this.setVisibility,
				"inspector:touch": this.updateInspector,
				"device:resize": this.onResize,
				"remove": this.remove
			}).render();
		},

		events: {
			"mouseleave": "onLeave"
		},

		render: function() {
			$("#wrapper").append(this.$el);
		},

		pushId: function(id) {
			this.ids.push(id);
		},

		setVisibility: function() {
			if ($(".inspector:hover").length) return;

			for (var i = this.ids.length - 1; i >= 0; --i) {
				var $hovered = $("[data-id='" + this.ids[i] + "']:hover");

				if ($hovered.length) return this.updateInspector($hovered);
			}

			$(".inspector-visible").removeClass("inspector-visible");
			this.$el.hide();
		},

		updateInspector: function($hovered) {
			if ($hovered.hasClass("inspector-visible")) return;

			var data = [];

			$(".inspector-visible").removeClass("inspector-visible");
			this.addOverlappedElements($hovered).each(function() {
				var $element = $(this);
				var attributes = $element.data().attributes;

				if (!attributes) return;

				data.push(attributes);
				$element.addClass("inspector-visible");
			});
			this.$el.html(Handlebars.templates.inspector(data)).removeAttr("style");
			this.positionInspector($hovered);
		},

		addOverlappedElements: function($hovered) {
			var checkOverlap = function() {
				var $element = $(this);
				var isOverlapped = $element.height() &&
					_.isEqual($element.offset(), $hovered.offset()) &&
					$element.width() === $hovered.width();

				if (isOverlapped) $hovered = $hovered.add($element);
			};

			for (var i = this.ids.length - 1; i >= 0; --i) {
				$("[data-id='" + this.ids[i] + "']").each(checkOverlap);
			}

			return $hovered;
		},

		positionInspector: function($hovered) {
			var offset = $hovered.offset();
			var inspectorHeight = this.getComputed("height");
			var $arrow = this.$(".inspector-arrow");
			var arrowHeight = $arrow.outerHeight() / 2;
			var inspectorWidth = this.getComputed("width");

			this.$el.css({
				top: offset.top - inspectorHeight - arrowHeight,
				left: offset.left + $hovered.width() / 2 - inspectorWidth / 2,
				width: inspectorWidth,
				height: inspectorHeight + arrowHeight
			});
			$arrow.css("top", Math.floor(inspectorHeight));
		},

		getComputed: function(property) {
			return typeof getComputedStyle !== "undefined" ?
				parseFloat(getComputedStyle(this.$el[0])[property], 10) :
				this.$el[property]();
		},

		onResize: function() {
			var $hovered = $(".inspector-visible");

			if (!$hovered.length) return;

			$hovered.removeClass("inspector-visible");

			if (!Adapt.device.touch) this.setVisibility();
			else this.updateInspector($hovered.last());
		},

		onLeave: function() {
			if (!Adapt.device.touch) this.setVisibility();
		}

	});

	var InspectorContainerView = Backbone.View.extend({

		initialize: function() {
			var id = this.model.get("_id");

			this.listenTo(Adapt, "remove", this.remove).addTracUrl(id);
			this.$el.attr("data-id", id).data(this.model);
			Adapt.trigger("inspector:id", id);
		},

		events: function() {
			return !Adapt.device.touch ?
				{ "mouseenter": "onHover", "mouseleave": "onHover" } :
				{ "touchend": "onTouch" };
		},

		addTracUrl: function(id) {
			var tracUrl = Adapt.config.get("_inspector")._tracUrl;

			if (!tracUrl) return;

			var title = $("<div/>").html(this.model.get("displayTitle")).text();
			var params = id;
			var adaptLocation = Adapt.location;
			var location = adaptLocation._currentId;
			var locationType = adaptLocation._contentType;

			if (title) params += " " + title;
			if (id !== location) params += " (" + locationType + " " + location + ")";

			tracUrl += "/newticket?summary=" + encodeURIComponent(params);
			this.model.set("_tracUrl", tracUrl);
		},

		onHover: function() {
			_.defer(function() { Adapt.trigger("inspector:hover"); });
		},

		onTouch: function(event) {
			if (event.originalEvent.inspectorStop) return;
			event.originalEvent.inspectorStop = true;

			if (!$(event.target).is("[class*=inspector-]")) {
				Adapt.trigger("inspector:touch", this.$el);
			}
		}

	});

	Adapt.once("app:dataReady", function() {
		var config = Adapt.config.get("_inspector");

		if (!config || !config._isEnabled) return;
		if (Adapt.device.touch && config._disableOnTouch) return;

		var views = config._elementsToInspect ||
			[ "menu", "page", "article", "block", "component", "tile" ];

		Adapt.on("router:location", function() {
			new InspectorView();
		}).on(views.join("View:postRender ") + "View:postRender", function(view) {
			new InspectorContainerView({ el: view.$el, model: view.model });
		});
	});

});
;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define('extensions/adapt-ios-fastclick/js/lib/fastclick',[],function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());
define('extensions/adapt-ios-fastclick/js/adapt-ios',[
        './lib/fastclick'
], function(FastClick) {

    $(function() {
        FastClick.attach(document.body);
    });

});
define('extensions/adapt-lightbox/js/adapt-lightbox-view',[
	"coreJS/adapt"
], function(Adapt) {

	var defaultConfig = {
		"_background": null,
	};

	var LightboxView = Backbone.View.extend({

		activeModel: null,
		activeConfig: null,
		isLightboxShowing: false,
		hasBackground: false,
		isInAnimation: false,
		className : "lightbox-container clearfix notify",
		_disableAnimations: false,

		events : {
			'click .close-button': 'onLightboxClose'
		},

		initialize : function(){

			_.bindAll(this, 'setupContent', 'setupBackground', 'tearDownContent','tearDownBackground','show','hide', 'scrollTo', 'onShowComplete', 'onHideComplete', 'onResize');
			this._disableAnimations = $('html').is(".ie8, .iPhone.version-7\\.0, .iPad, .iOS, .iPhone");
			this._isIOS = $('html').is(".iPad, .iOS, .iPhone");
			this.setupListeners();
			this.render();
		},

		setupListeners : function(){
			this.listenTo(Adapt, 'pageView:ready menuView:ready', this.onLocationReady);
			this.listenTo(Adapt, 'lightbox:show', this.onLightboxShow);
			this.listenTo(Adapt, 'lightbox:close', this.onLightboxClose);
			this.listenTo(Adapt, 'page:scrollTo', this.onWillScrollTo);
			this.listenTo(Adapt, 'remove', this.onRemove);

			this.listenTo(Adapt, 'articleBlockSlider:begin', this.onArticleBlockSliderBegin);
			this.listenTo(Adapt, 'articleBlockSlider:progress', this.onArticleBlockSliderProgress);
			this.listenTo(Adapt, 'articleBlockSlider:resize', this.onArticleBlockSliderResize);
			this.listenTo(Adapt, 'articleBlockSlider:complete', this.onArticleBlockSliderComplete);
		},

		render : function(){

			var data = {
				"isIOS": this._isIOS,
				"_globals": Adapt.course.get("_globals")
			};
	    	var template = Handlebars.templates['lightbox'];
	        this.$el.html(template(data));

	        this.setupResizeListeners();
		},

		setupResizeListeners: function() {
			this.onResize = _.debounce(this.onResize, 500);
			$(window).on("resize", this.onResize);
			this.$(".lightbox-popup-inner").on("resize", this.onResize);
		},

		onLocationReady: function() {
			this.$el.addClass("display-none");
		},

		onLightboxShow : function(lightboxId, scrollTo, scrollToSettings){

			if(!lightboxId) return;
			if (this.isLightboxShowing) return;


			if (_.indexOf(lightboxId, " ") > -1) {
				var lightboxIds = lightboxId.split(" ");
				lightboxId = lightboxIds[0];
				childId = lightboxIds[1];
				Adapt.trigger("articleBlockSlider:moveTo", "."+childId);
				/*Adapt.trigger("page:scrollTo", "."+childId);
				Adapt.trigger("page:scrolledTo", "."+childId);*/
			} else {
				Adapt.trigger("articleBlockSlider:moveTo", "."+lightboxId);
				/*Adapt.trigger("page:scrollTo", "."+lightboxId);
				Adapt.trigger("page:scrolledTo", "."+lightboxId);*/
			}

			this.isLightboxShowing = true;

			this.activeModel = Adapt.findById(lightboxId);
			this.activeConfig = _.extend({}, defaultConfig, this.activeModel.get('_lightbox') );

			Adapt.trigger('lightbox:will-show',  this.activeModel);

			$("body").scrollDisable();

			this.setupContent()
			.done(this.setupBackground)
			.done(this.show)
			.done(_.bind(this.scrollTo, this, scrollTo))
			.done(this.onShowComplete);
		},

		onLightboxClose : function(){

			if (!this.isLightboxShowing) return;

			Adapt.trigger('lightbox:will-hide',  this.activeModel);

			$("body").scrollEnable();

			this.hide()
			.done(this.tearDownBackground)
			.done(this.tearDownContent)
			.done(this.onHideComplete);
		},


		onWillScrollTo : function(selector){

			var id;
			if (selector.selector) {
				id = selector.selector.replace('.','');
			} else {
				id = selector.replace('.','');
			}


			var component = Adapt.findById(id);

			var lightboxParent = component.get('_lightboxParent');
			if(!lightboxParent) return;

			Adapt.set("_canScroll", false, {pluginName:"lightbox"});
			Adapt.trigger('lightbox:show', lightboxParent, selector);
		},

		setupBackground : function(){

			var deferred = $.Deferred();

			var $img = this.$('.lightbox-popup-background img');
			if (this.activeConfig._background && this.activeConfig._background._src) {
				$img.attr('src', this.activeConfig._background._src);
				this.$el.addClass('has-background');
				this.hasBackground = true;
				$img.imageready(deferred.resolve, { allowTimeout:false });
			} else {
				$img.attr('src', '');
				this.$el.removeClass('has-background');
				this.hasBackground = false;
				deferred.resolve();
			}


			return deferred;
		},

		tearDownBackground : function(){

			var deferred = $.Deferred();

			this.$el.removeClass('has-background');

			var $background = this.$('.lightbox-popup-background');
			var $backgroundImage = $background.find(".background-image");
			$backgroundImage.removeAttr("style");
			var $offset = $background.find(".offset");
			$offset.removeAttr("style");

			var $img = this.$('.lightbox-popup-background img');
			$img.attr('src', "").removeAttr("style");

			return deferred.resolve();
		},

		setupContent	: function(id){

			var deferred = $.Deferred();

			var components = this.activeModel.findDescendants('components');

			/*for(var i=0, model;model=components.models[i];i++){
				model.set('_isOptional', false);
			}*/

			this.$('.article-block-container >*').css('display','none');

			var $activeContent;
			if (this.activeModel.get("_type") == "article") {
				$activeContent = this.$('.article-block-container .' +this.activeModel.get('_id'));
				var $blocks = $activeContent.find(".block");
				$blocks.css("display", "inherit");
			} else if (this.activeModel.get("_type") == "block") {
				$activeContent = this.$('.article-block-container .' +this.activeModel.get('_id')).parent();
				var $blocks = $activeContent.find(".block");
				$blocks.css("display", "none").filter("."+this.activeModel.get('_id')).css("display","inherit");
			}

			$activeContent.addClass('active');
			$activeContent.css('display','inherit');



			return deferred.resolve();
		},


		tearDownContent : function(){

			var deferred = $.Deferred();

			var $activeContent;
			if (this.activeModel.get("_type") == "article") {
				$activeContent = this.$('.article-block-container .' +this.activeModel.get('_id'));
			} else if (this.activeModel.get("_type") == "block") {
				$activeContent = this.$('.article-block-container .' +this.activeModel.get('_id')).parent();
			}

			$activeContent.removeClass('active');

			return deferred.resolve();
		},

		show : function(id){
			var deferred = $.Deferred();
			var onDone = _.bind(function() {
				this.$('.popup').a11y_focus();
				deferred.resolved;
			}, this);

			this.$el.css({
				top: 0,
				opacity: 0
			});
			this.$el.removeClass("display-none");

			_.delay(_.bind(function() {
				this.alignPopup();
				this.configureBackground();

				var duration = 600;
				if (this._disableAnimations) duration = 0;

				Adapt.trigger("popup:opened", this.$('.popup'));


				this.$el.velocity({
					opacity:1
				},{
					complete:onDone,
					duration: duration
				});
			}, this), 250);

			return deferred;
		},

		alignPopup: function(height) {

			this.$el.removeClass("fullscreen");

			var size = Adapt.device.screenSize;
			if (this.activeConfig._minHeight && this.activeConfig._minHeight["_"+size]) {
				this.$el.css({
					"min-height":this.activeConfig._minHeight["_"+size]
				});
			}

			var popupHeight = height || this.$('.lightbox-popup').outerHeight();
			var windowHeight = $(window).innerHeight();

			var isFullscreen = this.activeConfig._fullscreen || false;
			if (windowHeight < popupHeight && !isFullscreen) {
				isFullscreen = true;
			}

			if (isFullscreen) {
				this.$el.addClass("fullscreen");
				this.$(".lightbox-popup-container").css({
					top: 0
				});
			} else {
				this.$el.removeClass("fullscreen");
				this.$(".lightbox-popup-container").css({
					top: (windowHeight/2) - (popupHeight/2)
				});

			}

		},

		configureBackground: function() {
			if (!this.hasBackground) return;

			var $img = this.$('.lightbox-popup-background img');
			$img.backgroundImage({
				"size": this.activeConfig._background._size,
				"position": this.activeConfig._background._position,
				"restrict": this.activeConfig._background._restrict
			});
		},

		hide : function(id){

			var deferred = $.Deferred();

			var onDone = _.bind(function(){
				this.$el.css('top', '100%');
				this.$el.addClass("display-none");
				deferred.resolve();
			}, this);

			var duration = 600;
			if (this._disableAnimations) duration = 0;

			Adapt.trigger("popup:closed");

			this.$el.velocity({
				opacity:0
			},{
				complete:onDone,
				duration:duration
			});

			return deferred;
		},

		scrollTo : function(selector){
			var deferred = $.Deferred();
			if(!selector) return deferred.resolve();

			selector.velocity("scroll", {
				container: this.$(".lightbox-popup.popup"),
				duration:2000
			});
		},

		onShowComplete : function(){

			Adapt.trigger('lightbox:did-show',  this.activeModel);
		},

		onHideComplete : function(){

			Adapt.trigger('lightbox:did-hide',  this.activeModel);
			this.activeModel = null;
			this.activeConfig = null;
			this.isLightboxShowing = false;
		},

		onResize: function() {
			if (!this.isLightboxShowing) return;
			if (this.isInAnimation) return;
			_.defer(_.bind(function() {
				if (!this.isLightboxShowing) return;
				if (this.isInAnimation) return;
				this.alignPopup();
				this.configureBackground();
			}, this));
		},

		onRemove: function() {
			this.onLightboxClose();
		},

		onArticleBlockSliderBegin: function() {
			this.isInAnimation = true;
		},

		onArticleBlockSliderProgress: function() {
			if (!this.isLightboxShowing) return;
			this.alignPopup();
			this.configureBackground();
		},

		onArticleBlockSliderResize: function() {
			if (!this.isLightboxShowing) return;
			this.alignPopup();
			this.configureBackground();
		},

		onArticleBlockSliderComplete: function() {
			this.isInAnimation = false;
			if (!this.isLightboxShowing) return;
			this.alignPopup();
			this.configureBackground();
		}

	});


	return LightboxView;

});
define('extensions/adapt-lightbox/js/adapt-lightbox-view-extension',[
    'coreJS/adapt',
    'coreViews/pageView', 
    'coreViews/articleView',    
], function(Adapt, PageView, ArticleView) {
    
    var LightBoxViewExtension = {

        addChildren: function() {

            var $lightbox = $(".lightbox-container .article-block-container");            

            if (this.model.get("_type") == "article") {
                var $blockContainer = $lightbox.find("[name='"+ this.model.get("_id")+"']");
                if ($blockContainer.length === 0) $blockContainer = $('<div class="' + this.model.get("_id") + '" name="' + this.model.get("_id") + '"></div>' );
                $lightbox.append( $blockContainer );
                $lightbox = $blockContainer;
            }
            
            var nthChild = 0;
            var children = this.model.getChildren();
            var models = children.models;

            for (var i = 0, len = models.length; i < len; i++) {

                var model = models[i];
                nthChild ++;
                var ChildView = this.constructor.childView || Adapt.componentStore[model.get("_component")];
                
                if (model.get('_isAvailable')) {

                    var lightboxConfig = model.get("_lightbox");
                    var $parentContainer;

                    var $childView = new ChildView({model:model}).$el;  

                    if (lightboxConfig && lightboxConfig._isEnabled) {

                        $parentContainer = $lightbox;
                        $childView.attr("name", model.get("_id"));                        

                        var components = model.findDescendants("components");
                        _.each(components.models, function(component) {

                            //component.set('_isOptional', true);
                            component.set('_lightboxParent', model.get('_id'));
                            
                            if (component.get("_isQuestionType") && component.get("_feedback") && lightboxConfig._feedback) {                                
                                component.get("_feedback")._type = lightboxConfig._feedback._type;                                
                            }
                        });
                    } 
                    else {
                        $parentContainer = this.$(this.constructor.childContainer);
                    }

                    model.set("_nthChild", nthChild);

                    $parentContainer.append($childView); 
                }
            }
        }

    };      




    /*  
        Here we are extending the pageView in Adapt.
        This is to accomodate the new functionality on the page.
        The advantage of this method is that the extension behaviour can utilize all of the predefined page behaviour in both the view.
    */  

    //Extends core/js/views/pageView.js
    var ViewInitialize = PageView.prototype.initialize;
    PageView.prototype.initialize = function(options) {
        
        var lightboxExtensions = this.model.getChildren().filter(function(item) {            
            return item.get("_lightbox") && item.get("_lightbox")._isEnabled;
        });        
        if (lightboxExtensions.length > 0) {
            //extend the pageView with new functionality
            _.extend(this, LightBoxViewExtension);
        }
        //initialize the page in the normal manner
        return ViewInitialize.apply(this, arguments);
    };





    /*  
        Here we are extending the articleView in Adapt.
        This is to accomodate the new functionality on the article.
        The advantage of this method is that the extension behaviour can utilize all of the predefined article behaviour in both the view.
    */  

    //Extends core/js/views/articleView.js
    var ViewInitialize = ArticleView.prototype.initialize;
    ArticleView.prototype.initialize = function(options) {
        
        var lightboxExtensions = this.model.getChildren().filter(function(item) {            
            return item.get("_lightbox") && item.get("_lightbox")._isEnabled;
        });        
        if (lightboxExtensions.length > 0) {
            //extend the articleView with new functionality
            _.extend(this, LightBoxViewExtension);
        }
        //initialize the page in the normal manner
        return ViewInitialize.apply(this, arguments);
    };


});
;(function( $) {

	if ($.fn.haveDimensionsChanged) return;

	$.fn.haveDimensionsChanged = function(oldDimensions) {
		if (this.length === 0) return false;
		return haveDimensionsChanged(this, oldDimensions);
	};

	function haveDimensionsChanged($ele, oldDimensions) {
        oldDimensions = oldDimensions || $ele.data("dimensions");

        var height = $ele.height();
        var width = $ele.width();
        var ratio = width / height;
        var dimensions = {
            "width": width,
            "height": height,
            "ratio": ratio
        };

        var hasChanged = false;

        if (oldDimensions) {
            if (oldDimensions.ratio != dimensions.ratio) hasChanged = true;
            else if (oldDimensions.height != dimensions.height) hasChanged = true;
        }

        if (!hasChanged) return false;
           
        $ele.data("dimensions", dimensions);

        return true;

    }

    $.fn.getDimensions = function(dynamicRatio) {
		if (this.length === 0) return false;
		return getDimensions(this, dynamicRatio);
	};

    function getDimensions($ele, dynamicRatio) {
        var dimensions;
        if (dynamicRatio === undefined) dynamicRatio = false;
        if (!dynamicRatio) {
            dimensions = $ele.data("dimensions");
            if (dimensions) return dimensions;
        }
        var height;
        var width;
        if ($ele.is("img")) {
            height = $ele[0].height;
            width = $ele[0].width;
        } else {
            height = $ele.height();
            width = $ele.width();
        }
        var ratio = width / height;
        var dimensions = {
            "width": width,
            "height": height,
            "ratio": ratio
        };
        if (!dynamicRatio) {
            $ele.data("dimensions", dimensions);
        }
        return dimensions;
    }

})( jQuery );
define("extensions/adapt-lightbox/js/libs/jquery.dimensions", function(){});

//https://github.com/cgkineo/jquery.backgroundImage 2015-08-18

;(function( $ ) {

    if ($.fn.backgroundImage) return;

    $.fn.backgroundImage = function(options) {

        options = options || {};
        if (options.dynamicRatio === undefined) options.dynamicRatio = false;
        if (options.expandContainerHeight === undefined) options.expandContainerHeight = true;
        if (options.expandHeight === undefined) options.expandHeight = undefined;
        if (options.selector === undefined) options.selector = "img";
        if (options.restrict === undefined) options.restrict = "auto auto";

        var $images = this.find(options.selector).add( this.filter(options.selector) );

        if ($images.length === 0) return;

        $images.each(function() {
            process($(this), options);
        });

    };

    function process($image, options) {
        var $offset = $image.parent();
        var $container = $offset.parent();
        var $containerParent = $container.parent();
        
        //reset image and offset
        $offset.css({
            "height": "",
            "width": "",
            "overflow": "hidden",
            "max-width": "100%",
            "max-height": "100%"
        });
        $image.css({
            "top": "",
            "left": "",
            "bottom": "",
            "right": "",
            "width": "",
            "height": "",
            "max-width": "100%",
            "max-height": "100%"
        });

        var imageDim = $image.getDimensions(options.dynamicRatio);

        //set/unset container height if required
        if (options.expandContainerHeight === true) {
            $container.css({
                "height": "100%"
            });
            if ($containerParent.height() > 0) {
                $container.css({
                    "height": $containerParent.height() + "px"
                });
            }
        } else if (options.expandContainerHeight === false) {
            $container.css({
                "height": ""
            });
        }

        var containerDim = $container.getDimensions(true);


        // set offset container to fill the width
        var offsetDimensions = {
            "width": "100%"
        };        
        
        /* only fill the height if asked in the settings or if the container height is larger than the offset height, 
        *  otherwise where content height is generated from the conent image, 
        *  100% height is meaningless before the image is in
        */
        if (containerDim.height > $offset.height() && offsetDimensions.height === undefined && options.expandHeight === undefined) {
            options.expandHeight = true;
            offsetDimensions.height = containerDim.height + "px";
        }
        //set offset style
        $offset.css(offsetDimensions);

        //capture body and container fontsize for rem and em calculations
        containerDim['fontSize'] = $container.css("font-size");
        var documentFontSize = $("body").css("font-size");
        
        //setup image for styling
        var imageDimensions = {
            "max-width": "none",
            "max-height": "none"
        };


        /* check the position variable to set the top left position of the image 
        *  inside it's overall container
        */
        var positionsDim;
        if (options.position !== undefined) {

            //setup image position styles for filling
            $.extend(imageDimensions, {
                "top": "",
                "left": "",
                "bottom": "",
                "right": ""
            });

            var positions = (options.position || "top left").split(" ");

            positionsDim = convertPositions(containerDim, imageDim, {
                "left": positions[0], 
                "top": positions[1], 
                "documentFontSize": documentFontSize
            });
            imageDimensions.top = positionsDim.top;
            imageDimensions.left = positionsDim.left;

        }

        //setup image size styles for filling
        if (options.size !== undefined) {
            $.extend(imageDimensions, {
                "width": "",
                "height": ""
            });
        }

        //setup image size (height / width);
        switch (options.size) {
        case undefined:
        case "contain":
            //default to contain if size is undefined, auto auto, or contain
            if (containerDim.ratio < imageDim.ratio) {
                var width = containerDim.width;
                imageDimensions.width = width + "px";
                imageDimensions.height = width / imageDim.ratio + "px"
            } else {
                var height = containerDim.height;
                imageDimensions.height = height + "px";
                imageDimensions.width = height * imageDim.ratio + "px"
            }
            break;

        case "cover":

            if (containerDim.ratio > imageDim.ratio) {
                var width = containerDim.width;
                imageDimensions.width = width + "px";
                imageDimensions.height = width / imageDim.ratio + "px"
            } else {
                var height = containerDim.height;
                imageDimensions.height = height + "px";
                imageDimensions.width = height * imageDim.ratio + "px"
            }
            break;

        default:
            //setup image value styles
            var sizes = (options.size || "100% auto").split(" ");
            var widthSize = sizes[0];
            var heightSize = sizes[1];

            var dims = convertDimensions(containerDim, imageDim, {
                "width": widthSize, 
                "height": heightSize,
                "documentFontSize": documentFontSize
            });

            imageDimensions.height = dims.height;
            imageDimensions.width = dims.width;

        }

        //correct any leftover styles with the image height/width if required
        if (imageDimensions.height === "auto") {
            imageDimensions.height = imageDim.height;
        }

        if (imageDimensions.width === "auto") {
            imageDimensions.width = imageDim.width;
        }

        //restrict the offset container (height/width) if required
        if (options.restrict !== undefined) {
            var restricts = options.restrict.split(" ");
            
            imageDimensions.ratio = imageDim.ratio;

            var dims = convertRestricts(containerDim, imageDimensions, {
                "width": restricts[0], 
                "height": restricts[1], 
                "documentFontSize": documentFontSize
            });

            offsetDimensions.width = dims.width;
            offsetDimensions.height = dims.height;

            $offset.css(offsetDimensions);
        }
        

        var offsetDim = $offset.getDimensions(true);

        //center, bottom or right align the image inside the offset container
        if (imageDimensions.top === "center") {
            var height = imageDimensions.height === undefined ? imageDim.height : parseInt(imageDimensions.height);
            imageDimensions.top = ((offsetDim.height / 2) - (parseFloat(height) / 2)) + "px";
        } else if (imageDimensions.top === "bottom") {
            var height = imageDimensions.height === undefined ? imageDim.height : parseInt(imageDimensions.height);
            imageDimensions.top = ((offsetDim.height) - (parseFloat(height))) + "px";
        }
        if (imageDimensions.left === "center") {
            var width = imageDimensions.width === undefined ? imageDim.width : parseFloat(imageDimensions.width);
            imageDimensions.left = ((offsetDim.width / 2) - (parseFloat(width) / 2)) + "px";
        } else if (imageDimensions.left === "right") {
            var width = imageDimensions.width === undefined ? imageDim.width : parseFloat(imageDimensions.width);
            imageDimensions.left = ((offsetDim.width) - (parseFloat(width))) + "px";
        }

        //apply the style
        $image.css(imageDimensions);
    }

    function arrayIndexOf(arr, value) {
        if (arr.indexOf) return arr.indexOf(value);
        for (var i = 0, l = arr.length; i < l; i++) {
            if (arr[i] == value) return i;
        }
        return -1;
    }

    function convertDimensions(container, image, settings) {
        var dim = {
            "width": 0,
            "height": 0
        };
        if (settings.width === undefined) settings.width = "auto";
        if (settings.height === undefined) settings.height = "auto";

        dim.width = convertDimension(container.width, settings.width, container.fontSize, settings.documentFontSize);
        dim.height = convertDimension(container.height, settings.height, container.fontSize, settings.documentFontSize);

        var autos = {
            "width": isAuto(dim.width),
            "height": isAuto(dim.height)
        };

        if (autos.width && autos.height) {
            if (container.ratio < image.ratio) {
                dim.width = container.width + "px";
                dim.height = (container.width / image.ratio) + "px"
            } else {
                dim.height = container.height + "px";
                dim.width = (container.height * image.ratio) + "px";
            }
        } else if (autos.width) {
            dim.width = (parseFloat(dim.height) * image.ratio) + "px";
        } else if (autos.height) {
            dim.height = (parseFloat(dim.width) / image.ratio) + "px";
        }

        return dim;

    }

    function convertDimension(containerValue, settingsValue, containerFontSize, documentFontSize) {
        if (isAuto(settingsValue)) {
            return "auto";
        } else if (isPercent(settingsValue)) {
            var val = parseFloat(settingsValue);
            return ((containerValue / 100) * val) + "px";
        } else if (isPixel(settingsValue)) {
            return parseFloat(settingsValue) + "px";
        } else if (isREM(settingsValue)) {
            return (documentFontSize * parseFloat(settingsValue)) + "px";
        } else if (isEM(settingsValue)) {
            return (containerFontSize * parseFloat(settingsValue)) + "px";
        }
        return "auto";
    }

    function convertPositions(container, image, settings) {
        var dim = {
            "left": 0,
            "top": 0
        };
        if (settings.left === undefined) settings.left = "left";
        if (settings.top === undefined) settings.top = "top";

        var swapped = false;
        switch (settings.left) {
        case "top": case "bottom":
            var a = settings.top;
            settings.top = settings.left;
            settings.left = a;
            swapped = true;
        }

        switch (settings.top) {
        case "left": case "right":
            if (!swapped) {
                var a = settings.top;
                settings.top = settings.left;
                settings.left = a;
                swapped = true;
            } else {
                settings.top = "top";
            }
        }

        dim.left = convertPosition(container.width, settings.left, container.fontSize, settings.documentFontSize);
        dim.top = convertPosition(container.height, settings.top, container.fontSize, settings.documentFontSize);

        if (dim.left === "auto") dim.left = "0px";
        if (dim.top === "auto") dim.top = "0px";

        return dim;
    }

    function convertPosition(containerValue, settingsValue, containerFontSize, documentFontSize) {
        if (isAuto(settingsValue)) {
            return "auto";
        } else if (isPercent(settingsValue)) {
            var val = parseFloat(settingsValue);
            return ((containerValue / 100) * val) + "px";
        } else if (isPixel(settingsValue)) {
            return parseFloat(settingsValue) + "px";
        } else if (isREM(settingsValue)) {
            return (documentFontSize * parseFloat(settingsValue)) + "px";
        } else if (isEM(settingsValue)) {
            return (containerFontSize * parseFloat(settingsValue)) + "px";
        }
        switch(settingsValue) {
        case "center":
            return "center";
        case "top":
            return "0px"
        case "left":
            return "0px"
        case "bottom":
            return "bottom";
        case "right":
            return "right";
        }
        return "auto";
    }

    function convertRestricts(container, image, settings) {
        var dim = {
            "width": 0,
            "height": 0
        };
        if (settings.width === undefined) settings.width = "auto";
        if (settings.height === undefined) settings.height = "auto";

        dim.width = convertDimension(container.width, settings.width, container.fontSize, settings.documentFontSize);
        dim.height = convertDimension(container.height, settings.height, container.fontSize, settings.documentFontSize);

        var autos = {
            "width": isAuto(dim.width),
            "height": isAuto(dim.height)
        };

        if (autos.width && autos.height) {
            dim.height = parseFloat(image.height) + "px";
            dim.width =  parseFloat(image.width) + "px";
        } else if (autos.width) {
            dim.width = parseFloat(image.width) + "px";
        } else if (autos.height) {
            dim.height = parseFloat(image.height) + "px";
        }

        return dim;

    }

    function isAuto(value) {
        return (/(auto){1}/gi).test(value);
    }

    function isRelative(value) {
        return (/^(\+|\-){1}/g).text(value);
    }

    function isPercent(value) {
        return (/\%{1}/g).test(value);
    }

    function isPixel(value) {
        return (/(px){1}/gi).test(value);
    }

    function isREM(value) {
        return (/(rem){1}/gi).test(value);
    }

    function isEM(value) {
        return (/(em){1}/gi).test(value);
    }
  

})( jQuery );

define("extensions/adapt-lightbox/js/libs/jquery.backgroundimage", function(){});

$(function() {


	
	$.scrollBarSize = function() {
		var scrollDiv = $('<div style="width: 100px;height: 100px;overflow: scroll;position: absolute;top: -9999px;"></div>');
		$("body").append(scrollDiv);
		var scrollBarSize = scrollDiv[0].offsetWidth - scrollDiv[0].clientWidth;
		scrollDiv.remove();
		return scrollBarSize;
	};
	

});
define("extensions/adapt-lightbox/js/libs/jquery.scrollBarSize", function(){});

define('extensions/adapt-lightbox/js/adapt-lightbox',[
	"coreJS/adapt",
	"./adapt-lightbox-view",
	"./adapt-lightbox-view-extension",
	"./libs/jquery.dimensions",
	"./libs/jquery.backgroundimage",
	"./libs/jquery.scrollBarSize",
], function(Adapt, LightboxView) {	

    Adapt.on("app:dataReady", function() {

    	var _globals = Adapt.course.get("_globals");
        var lightbox = Adapt.course.get("_lightbox");

    	//super hacky fix for ios fixed position elements and desktop window scrolling
        var isHackOn =  (lightbox && 
                        lightbox._hackOnClasses && 
                        $("html").is(lightbox._hackOnClasses));
        var isNoConfig = (!lightbox ||
                        !lightbox._hackOnClasses);
        if (isHackOn || isNoConfig) {
            $("html").addClass("lightbox-hack");
        	var $scrollingContainer = $('<div class="scrolling-container"><div class="scrolling-inner body"></div></div>');
            var $scrollingInner = $scrollingContainer.find(".scrolling-inner");
        	$("body").append($scrollingContainer);
        	$("#wrapper").appendTo($scrollingInner);
        	var originalScrollTo = $.fn.scrollTo;
        	$.fn.scrollTo = function(target, duration, settings) {
        		if (this[0] === window) {
        			return originalScrollTo.apply($(".scrolling-container"), arguments);
        		} else {
        			return originalScrollTo.apply(this, arguments);
        		}
        	};
        	var originalScrollTop = $.fn.scrollTop;
        	$.fn.scrollTop = function() {
        		if (this[0] === window) {
        			return originalScrollTop.apply($(".scrolling-container"), arguments);
        		} else {
        			return originalScrollTop.apply(this, arguments);
        		}
        	};
            var jqueryOffset = $.fn.offset;
            $.fn.offset = function() {
                var offset = jqueryOffset.call(this);
                //console.log("fetching offset", offset.top, offset.left);
                var $stack = this.parents().add(this);
                var $scrollParents = $stack.filter(".scrolling-container");
                $scrollParents.each(function(index, item) {
                    var $item = $(item);
                    var scrolltop = parseInt($item.scrollTop());
                    var scrollleft = parseInt($item.scrollLeft());
                    offset.top += scrolltop;
                    offset.left += scrollleft;
                });
                return offset;
            };
            window.scrollTo = function(x,y) {
                //console.log("window scrollTo", x || 0, y || 0);
                $(".scrolling-container")[0].scrollTop = y || 0;
                $(".scrolling-container")[0].scrollLeft = x || 0;
            };

            //ios navigation fixed inside scrollable jump fix
            var $navigationContainer = $('<div class="navigation-container"></div>');
            $("body").prepend($navigationContainer);

            Adapt.once("adapt:initialize", function() {
                $(".navigation").prependTo($navigationContainer);
            });

            //ios rendering glitch fix
            Adapt.on("menuView:ready pageView:ready", function() {
                $("html").removeClass("lightbox-hack");
                _.defer(function() {
                    $("html").addClass("lightbox-hack");                })
            });
            $(".scrolling-container").on("scroll", function() {
                $(window).trigger("scroll");
            });
        }
    	//end of super hacky fix

    	$("body").prepend(new LightboxView({
    		_globals: _globals
    	}).$el);
    });	

});
/*
* adapt-menu-controller
* License - https://github.com/cgkineo/adapt-menu-controller/LICENSE
* Maintainers - Dan Ghost <daniel.ghost@kineo.com>, Oliver Foster<oliver.foster@kineo.com>
*/
define('extensions/adapt-menu-controller/js/adapt-menu-controller',['require','coreJS/adapt'],function(require) {

    var Adapt = require('coreJS/adapt');

    var MenuController = Backbone.View.extend({

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
        },

        onDataReady: function() {
            
            //check if any menus have been registered
            if (_.keys(Adapt.menuStore).length === 0) {
                console.log("No menus registered, using old menu format");
            } else {
                console.log("Menus registered, disabling old menu format");
                //Adapt.off("router:menu");
                this.listenTo(Adapt, "router:menu", this.onMenu)
                this.listenTo(Adapt, "router:page", this.onPage);
                this.listenTo(Adapt, "device:change", this.onDeviceChange);
            }

        },

        onMenu: function(model) {
            this.stopListening(Adapt, "device:change", this.onDeviceChange);

            //fetch the type of menu that should be drawn
            var menuType = model.get('_menuType');
            menuType = this.compareScreenSize(menuType);

            if (!menuType) {
                console.log("No menu found for this route!");
                return;
            }

            this.listenTo(Adapt, "device:change", this.onDeviceChange);

            var MenuView = Adapt.menuStore[menuType];
            var menuItem = new MenuView({model:model}).$el;
            $('#wrapper').append(menuItem);

        },

        onPage: function() {
            this.stopListening(Adapt, "device:change", this.onDeviceChange);
        },

        onDeviceChange: function() {
            //dynamically change the menu by rerouting to current location
            var to = window.location.hash == "" ? "#/" : window.location.hash;
            Backbone.history.navigate(to, {trigger: true, replace: true});
        },

        compareScreenSize: function(settings) {
            if (typeof settings == "object") {

                /*
                    takes:

                    {
                        "small medium large": "co-30",
                        "medium large": "co-25",
                        "small touch": "co-19",
                        "small notouch": "co-21"
                    }

                    or any combination of the small medium and large names
                    touch and notouch are exclusive parameters

                */

                var found = undefined;
                for (var screenSize in settings) {

                    var sizes =  screenSize.split(" ");

                    var isMatchingSize = _.indexOf(sizes, Adapt.device.screenSize) > -1;
                    var isTouchMenuType = _.indexOf(sizes, "touch") > -1;
                    var isNoTouchMenuType = _.indexOf(sizes, "notouch") > -1;

                    if ( isMatchingSize && ((isNoTouchMenuType && !Modernizr.touch) || (!isNoTouchMenuType)) && ((isTouchMenuType && Modernizr.touch) || (!isTouchMenuType)) ) {
                        found = settings[screenSize];
                        break;
                    }
                }
                if (found === undefined) return false;
                
                return found;
            }

            //assume settings is a string id "co-30"
            return settings;
        }

    });

    //Allow menus to store their instanciators, like with components
    Adapt.menuStore = {};
    Adapt.registerMenu = function(name, object) {
        if (Adapt.menuStore[name]) throw Error('This menu already exists in your project');

        Adapt.menuStore[name] = object;
    }

    Adapt.menuController = new MenuController();

});
define('extensions/adapt-navigation-title/js/navigation',[
	'core/js/adapt'
], function(Adapt) {



	var NavigationView = Backbone.View.extend({

		className: function() {
			return [
				'navigation-title'
			].join(" ");
		},

		tagName: "div",

		events: {
			"click button": "onClick"
		},

		initialize: function(options) {
			this.parent = options.parent;
			this.setUpEventListeners();
			this.render();
		},

		setUpEventListeners: function() {
			this.onScroll = _.debounce(_.bind(this.onScroll, this), 17);
			$(window).on("scroll", this.onScroll);
		},

		onScroll: function() {
			if ($("html").is(".size-large")) {
				$(".navigation").css({
					"transform": "translateY(0%)",
					"-webkit-transform": "translateY(0%)"
				});
				return;
			}

			if ($(window).scrollTop() >= 32) {
				$(".navigation").css({
					"transform": "translateY(-100%)",
					"-webkit-transform": "translateY(-100%)"
				});
			} else {
				$(".navigation").css({
					"transform": "translateY(0%)",
					"-webkit-transform": "translateY(0%)"
				});
			}
		},

		render: function() {
			var template = Handlebars.templates[this.constructor.template];
			this.$el.append(template(this.model.toJSON()));
		},

		remove: function() {
			this.parent = null;
			Backbone.View.prototype.remove.call(this);
		}

	}, {
		template: "navigation-title"
	});

	return NavigationView;

});
define('extensions/adapt-navigation-title/js/adapt-navigation-title',[
    'coreJS/adapt',
    './navigation'
], function(Adapt,NavigationView) {

    var Nav = Backbone.View.extend({

        initialize: function() {
            this.listenTo(Adapt, "remove", this.remove);
            this.setUpNavigation();
            this.setUpNavigationBackButton();
        },

        setUpNavigation: function() {
            this.navigationView = new NavigationView({
                model: this.model,
                parent: this
            });
            this.navigationView.$el.insertBefore($(".navigation-back-button"));
        },

        setUpNavigationBackButton: function() {
            var hideBackButton = this.model.get("_hideBackButton");
            if (!hideBackButton) return;

            $('.navigation-back-button').addClass('display-none');
        },

        remove: function() {
            this.unsetNavigationBackButton();
            this.removeNavigationView();
            Backbone.View.prototype.remove.call(this);
        },

        unsetNavigationBackButton: function() {
            var hideBackButton = this.model.get("_hideBackButton");
            if (!hideBackButton) return;

            $('.navigation-back-button').removeClass('display-none');
        },

        removeNavigationView: function() {
            if (!this.navigationView) return;
            this.navigationView.remove();
            this.navigationView = null;
        }

    }, {
        template: 'video-cover'
    });

    Adapt.on("pageView:postRender", function(view) {

        if (!view.model.get("_navigation-title")) return;

        new Nav({model:view.model});

    });

});

define('extensions/adapt-pageIncompletePrompt/js/adapt-pageIncompletePrompt',[
    'coreJS/adapt'
], function(Adapt) {


    var PageIncompletePrompt = _.extend({
        
        PLUGIN_NAME: "_pageIncompletePrompt",

        handleRoute: true,
        inPage: false,
        inPopup: false,
        pageComponents: null,
        pageModel: null,
        routeArguments: null,
        model: null,

        _ignoreAccessibilityNavigation: false,

        initialize: function() {
            this.setupEventListeners();
        },

        setupEventListeners: function() {
            this.listenToOnce(Adapt, "app:dataLoaded", this.setupModel);
            this.listenTo(Adapt, "pageView:ready", this.onPageViewReady);
            this.listenTo(Adapt, "pageIncompletePrompt:leavePage", this.onLeavePage);
            this.listenTo(Adapt, "pageIncompletePrompt:cancel", this.onLeaveCancel);
            this.listenTo(Adapt, "router:navigate", this.onRouterNavigate);
        },

        setupModel: function() {
            this.model = Adapt.course.get(this.PLUGIN_NAME);
            this.listenTo(Adapt, "accessibility:toggle", this.onAccessibilityToggle);
        },

        onPageViewReady: function() {
            this.inPage = true;
            this.pageModel = Adapt.findById(Adapt.location._currentId);
            this.pageComponents = this.pageModel.findDescendants("components").where({"_isAvailable": true});
        },

        onLeavePage: function() {
            if (!this.inPopup) return;
            this.inPopup = false;

            this.stopListening(Adapt, "notify:cancelled");
            this.enableRouterNavigation(true);
            this.handleRoute = false;
            this.inPage = false;

            Adapt.trigger("router:navigateTo", this.routeArguments);

            this.handleRoute = true;
        },

        onLeaveCancel: function() {
            if (!this.inPopup) return;
            this.inPopup = false;
            
            this.stopListening(Adapt, "notify:cancelled");
            this.routeArguments = undefined;
            this.enableRouterNavigation(true);
            this.handleRoute = true;
        },

        onRouterNavigate: function(routeArguments) {
            
            if(!this.isEnabled() || this.allComponentsComplete()) return;

            if (routeArguments[0]) {
                //check if routing to current page child
                //exit if on same page
                try {
                    var id = routeArguments[0];
                    var model = Adapt.findById(id);
                    var parent = model.findAncestor("contentObjects");
                    if (parent.get("_id") == this.pageModel.get("_id")) return;
                } catch (e) {}
            }

            if (this._ignoreAccessibilityNavigation) {
                this._ignoreAccessibilityNavigation = false;
                return;
            }

            this.enableRouterNavigation(false)
            this.routeArguments = routeArguments;
            this.inPopup = true;
            
            var promptObject;
    		var pageIncompletePromptConfig = this.pageModel.get("_pageIncompletePrompt");
    		if (pageIncompletePromptConfig && pageIncompletePromptConfig._buttons) {
    			promptObject = {
    				title: pageIncompletePromptConfig.title,
    				body: pageIncompletePromptConfig.message,
    				_prompts:[{
    				        promptText: pageIncompletePromptConfig._buttons.yes,
    				        _callbackEvent: "pageIncompletePrompt:leavePage",
    				},{
    				        promptText: pageIncompletePromptConfig._buttons.no,
    				        _callbackEvent: "pageIncompletePrompt:cancel"
    				}],
    				_showIcon: true
    			};
    		} else {
    			promptObject = {
    				title: this.model.title,
    				body: this.model.message,
    				_prompts:[{
    				        promptText: this.model._buttons.yes,
    				        _callbackEvent: "pageIncompletePrompt:leavePage",
    				},{
    				        promptText: this.model._buttons.no,
    				        _callbackEvent: "pageIncompletePrompt:cancel"
    				}],
    				_showIcon: true
    			};
    		}

            this.listenToOnce(Adapt, "notify:cancelled", this.onLeaveCancel);

            Adapt.trigger("notify:prompt", promptObject);
        },

        onAccessibilityToggle: function() {
            if (Adapt.device.touch) {
                //accessibility is always on for touch devices
                //ignore toggle
                this._ignoreAccessibilityNavigation = false;
            } else {
                //skip renavigate for accessibility on desktop
                this._ignoreAccessibilityNavigation = true;
            }
        },

        isEnabled: function() {
            if (!Adapt.location._currentId) return false;
            if (!this.handleRoute) return false;
            if (!this.inPage) return false;
            if (this.inPopup) return false;
            
            switch (Adapt.location._contentType) {
            case "menu": case "course":
                this.inPage = false;
                return false;
            }
            var pageModel = Adapt.findById(Adapt.location._currentId);
            if (pageModel.get("_isOptional")) return false;
            var isEnabledForCourse = this.model && !!this.model._isEnabled;
            var isEnabledForPage = pageModel.get("_pageIncompletePrompt") && !!pageModel.get("_pageIncompletePrompt")._isEnabled;               
            return (isEnabledForCourse && isEnabledForPage !== false) || isEnabledForPage;
        },

        allComponentsComplete: function() {
            
            if(this.pageComponents === null) return true;
            
            for(var i = 0, count = this.pageComponents.length; i < count; i++) {
                var component  = this.pageComponents[i];
                var isMandatory = (component.get('_isOptional') === false);
                var isComplete = component.get("_isComplete");
            
                if(isMandatory && !isComplete) return false;   
            }
            
            return true;
        },

        enableRouterNavigation: function(value) {
            Adapt.router.set("_canNavigate", value, { pluginName: this.PLUGIN_NAME });
        }

    }, Backbone.Events);

    PageIncompletePrompt.initialize();

    return PageIncompletePrompt;

});

/* 2016-04-20 https://github.com/cgkineo/speedtest */
/*!
 * JavaScript Cookie v2.1.1
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */


(function() {

	if (window.speedtest) return;

//COOKIES
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function overlay (a,b) {
		for (var k in b) {
			a[k] = b[k];
		}
		return a;
	}

	function initCookie (converter) {
		function api (key, value, attributes) {
			var result;
			if (typeof document === 'undefined') {
				return;
			}

			// Write

			if (arguments.length > 1) {
				attributes = extend({
					path: '/'
				}, api.defaults, attributes);

				if (typeof attributes.expires === 'number') {
					var expires = new Date();
					expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
					attributes.expires = expires;
				}

				try {
					result = JSON.stringify(value);
					if (/^[\{\[]/.test(result)) {
						value = result;
					}
				} catch (e) {}

				if (!converter.write) {
					value = encodeURIComponent(String(value))
						.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
				} else {
					value = converter.write(value, key);
				}

				key = encodeURIComponent(String(key));
				key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
				key = key.replace(/[\(\)]/g, escape);

				return (document.cookie = [
					key, '=', value,
					attributes.expires && '; expires=' + attributes.expires.toUTCString(), // use expires attribute, max-age is not supported by IE
					attributes.path    && '; path=' + attributes.path,
					attributes.domain  && '; domain=' + attributes.domain,
					attributes.secure ? '; secure' : ''
				].join(''));
			}

			// Read

			if (!key) {
				result = {};
			}

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling "get()"
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var rdecode = /(%[0-9A-Z]{2})+/g;
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var name = parts[0].replace(rdecode, decodeURIComponent);
				var cookie = parts.slice(1).join('=');

				if (cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					cookie = converter.read ?
						converter.read(cookie, name) : converter(cookie, name) ||
						cookie.replace(rdecode, decodeURIComponent);

					if (this.json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					if (key === name) {
						result = cookie;
						break;
					}

					if (!key) {
						result[name] = cookie;
					}
				} catch (e) {}
			}

			return result;
		}

		api.set = api;
		api.get = function (key) {
			return api(key);
		};
		api.getJSON = function () {
			return api.apply({
				json: true
			}, [].slice.call(arguments));
		};
		api.defaults = {};

		api.remove = function (key, attributes) {
			api(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.withConverter = initCookie;

		return api;
	}
	var Cookie = initCookie(function () {});

//DOM MANIPULATION
	var $ = {

		domloaded: false,
		html: document.getElementsByTagName("html")[0],

		debounce: function(callback, timeout) {
			var timerhandle = null;
			return function() {
				if (timerhandle) clearTimeout(timerhandle);
				timerhandle = setTimeout(function() {
					callback();
				}, timeout || 17);
			};
		},

		one: function(dom, event, callback) {
			dom['_speedtest'+event] = $.callbackOnce(callback, dom);
			if (document.addEventListener) {
				dom.addEventListener(event, dom['_speedtest'+event], false);
			} else if (document.attachEvent)  {
				dom.attachEvent("on"+event, dom['_speedtest'+event]);
			}
		},

		on: function(dom, event, callback) {
			if (document.addEventListener) {
				dom.addEventListener(event, callback, false);
			} else if (document.attachEvent)  {
				dom.attachEvent("on"+event, callback);
			}
		},

		callbackOnce: function(callback, dom) {
			var callbackOnce =  function(e) {
				callback();
				$.off(dom, e.type, callbackOnce);
			};
			return callbackOnce;
		},

		off: function(dom, event, callback) {
			if (document.addEventListener) {
				dom.removeEventListener(event, callback);
			} else if (document.attachEvent)  {
				dom.detachEvent("on"+event, callback);
			}
		},

		attr: function(dom, name, value) {
			if (value === undefined) {
				return dom.getAttribute(name) || "";
			} else {
				dom.setAttribute(name, value);
			}
		},

		onDocumentLoaded: function(callback, no_wait_for_document) {
			if ($.domloaded) callback();
			if (no_wait_for_document) {
				setTimeout(callback, no_wait_for_document);
				return;
			}
			if (document.addEventListener) {
				$.one(document, "DOMContentLoaded", callback);
			} else if (document.attachEvent)  {
				$.on(document, "readystatechange", function() {
					if (document.readyState == "interactive") {
						callback();
					}
				});
			}
		},

		addClass: function(dom, className) {
			var classNames = $.attr(dom, "class").split(" ");
			for (var i = classNames.length-1, l = -1; i > l; i--) {
				if (classNames[i].toLowerCase() === className) {
					return;
				}
				if (classNames[i] === "") {
					classNames.splice(i,1);
				}
			}
			classNames.push(className);
			$.attr(dom, "class", classNames.join(" "));
		},

		removeClass: function(dom, className) {
			var classNames = $.attr(dom, "class").split(" ");
			for (var i = classNames.length-1, l = -1; i > l; i--) {
				if (classNames[i].toLowerCase() === className) {
					classNames.splice(i,1);
				}
				if (classNames[i] === "") {
					classNames.splice(i,1);
				}
			}
			$.attr(dom, "class", classNames.join(" "));
		}
	};

//SPEED TEST
	var speedtest = window.speedtest = {

		kbps: 0,
		low_kbps: 10000000,

		config: function(config) {
			speedtest.config.imagesURL = config.imagesURL;
			speedtest.config.interval = config.interval || speedtest.config.interval;
			speedtest.config.sample_age = config.sample_age || speedtest.config.sample_age;
			speedtest.config.idle_timeout = config.idle_timeout || speedtest.config.idle_timeout;
			speedtest.config.slow_threshold_kbps = config.slow_threshold_kbps || speedtest.config.slow_threshold_kbps;
			speedtest.config.offline_threshold_kbps = config.offline_threshold_kbps || speedtest.config.offline_threshold_kbps;
			speedtest.config.no_wait_for_document = config.no_wait_for_document || speedtest.config.no_wait_for_document;
			return speedtest;
		},

		test: function(callback) {

			for (var i = 0, l = priv.images.length; i < l; i++) {
				var img = priv.images[i];
				img.url = speedtest.config.imagesURL + "/" + img.name;
				priv.images[i].index = i;
			}

			priv.bandwidth({
				completedCount: 0,
				complete: function(rate) {
			
					var bytes_per_second = (priv.bytes_per_millisecond) * 1000;
					var bits_per_second = (bytes_per_second) * 8;
					var average_kilobits_per_second = (bits_per_second) / 1024;

					speedtest.kbps = Math.round(average_kilobits_per_second);
					speedtest.name = priv.get_speed_name(speedtest.kbps);

					var low_name = speedtest.low_name;
					var low_kbps = speedtest.low_kbps;

					if (speedtest.kbps < speedtest.low_kbps) {
						low_name = speedtest.name;
						low_kbps = speedtest.kbps;
					}

					priv.overtime.push({
						timestamp: (new Date()).getTime(),
						kbps: speedtest.kbps
					});

					var overtime = priv.calculateOvertime();
					if (overtime && overtime.kbps <= speedtest.kbps) {
						low_name = overtime.name;
						low_kbps = overtime.kbps;
					}

					Cookie.set("speedtest", JSON.stringify({
						low_name: low_name,
						low_kbps: low_kbps
					}));

					if (speedtest.low_name && speedtest.low_name !== low_name) {
						$.removeClass($.html, "speedtest-"+speedtest.low_name);
					}
					$.addClass($.html, "speedtest-"+low_name);
					
					speedtest.low_name = low_name;
					speedtest.low_kbps = low_kbps;

					if (typeof callback === "function") {
						callback.call(speedtest, low_name, low_kbps);
					}
				}
			});

			return speedtest;
		},

		onchange: function(callback, options) {

			options = options || {};
			if (options.immediate === undefined) options.immediate = true;
			if (options.on_rate_change === undefined) options.on_rate_change = false;

			priv.inchange = false;

			if (typeof callback !== "function") throw "onchange requires a callback function";

			priv.onchanges.push({
				callback: callback,
				options: options
			});
			callback._speedtestid = priv.uid++;

			priv.startChangeTimeout(options && options.immediate);

			priv.onInteraction();

			return speedtest;
		},

		offchange: function(callback) {
			for (var i = priv.onchanges.length-1, l = -1; i > l; i--) {
				if (callback === undefined || priv.onchanges[i].callback._speedtestid === callback._speedtestid) {
					priv.onchanges.splice(i,1);
				}
			}
			if (priv.onchanges.length === 0) {
				priv.finishChangeTimeout();
			}
			return speedtest;
		},

		

	};

//PRIVATE SPEEDTEST
	var priv = {

		imgs: [],

		received_bytes: 0,
		overall_milliseconds: 0,
		bytes_per_millisecond: 0,

		min_timeout: 500, // timeout before cancelling unfinished image downloads
		max_timeout: 2000,  // timeout before cancelling all image downloads
		allow_timeout: false,
		timedout: false,

		onchanges: [],
		change_timeout: null,
		interaction_timeout: null,
		uid: 0,		

		previous_low_kbps: null,
		previous_low_name: null,

		overtime: [],

		images: [
			{
				name: 'image-0.gif', //to determine latency
				type: 'overhead',
				size: 35
			},
			{
				name: 'image-1.png', //inaccurate but need for slow gprs, 2g, 3g
				type: 'minimum',
				size: 440
			},
			{
				name: 'image-4.png', //more accurate needed for 3g, dsl
				type: 'reset',
				size: 40836
			},
			{
				name: 'image-6.png', //better accuracty for 4g+
				size: 381756
			}
		],

		calculateOvertime: function() {
			var now = (new Date()).getTime();

			var min_kbps = 1000000000, total_count = 0, total_kbps = 0;
			for (var i = priv.overtime.length -1, l = -1; i > l; i--) {
				var ot = priv.overtime[i];
				if (now - ot.timestamp > speedtest.config.sample_age) {
					priv.overtime.splice(i,1);
				} else {
					if (ot.kbps < min_kbps) min_kbps = ot.kbps;
					total_kbps += ot.kbps;
					total_count++;
				}
			}
			if (total_count === 0) return;

			var average_kbps = total_kbps / total_count;

			var overtime = {};
			overtime.kbps = Math.round((min_kbps + average_kbps) / 2);
			overtime.name = priv.get_speed_name(overtime.kbps);

			return overtime;

		},

		startChangeTimeout: function(immediate) {

			if (priv.change_timeout) return;

			if (immediate) {
				priv.inchange = true;
				speedtest.test(priv.performChange);
			}

			priv.change_timeout = setInterval(function() {

				if (priv.inchange) return;
				priv.inchange = true;

				speedtest.test(priv.performChange);

			}, speedtest.config.interval);
		},

		finishChangeTimeout: function() {
			clearInterval(priv.change_timeout);
			priv.change_timeout = null;
		},

		performChange: function(rounded_average_kilobits_per_second, speed_name) {

			priv.inchange = false;

			for (var i = 0, l = priv.onchanges.length; i < l; i++) {
				if (priv.previous_low_name !== null && priv.previous_low_name === speedtest.low_name && !priv.onchanges[i].options.on_rate_change) continue;
				if (priv.previous_low_kbps !== null && priv.previous_low_kbps === speedtest.low_kbps) continue;
				priv.onchanges[i].callback(speedtest.low_name, speedtest.low_kbps);
			}

			priv.previous_low_name = speedtest.low_name;
			priv.previous_low_kbps = speedtest.low_kbps;

		},

		get_speed_name: function(rounded_average_kilobits_per_second) {
			if (speedtest.config.offline_threshold_kbps >= rounded_average_kilobits_per_second) return "offline";
			if (speedtest.config.slow_threshold_kbps >= rounded_average_kilobits_per_second) return "slow";
			return "fast";
		},

		bandwidth: function(options) {
			var start = (new Date()).getTime();

			priv.overall_milliseconds = 0;
			priv.received_bytes = 0;
			priv.timedout = false;
			priv.cancelled = false;
			priv.allow_timeout = false;
			priv.bytes_per_millisecond = 0;
			options.completed = false;

			if ($.domloaded) run();
			else $.onDocumentLoaded(run, speedtest.config.no_wait_for_document);

			function run() {
				priv.bandwidth_unit({
					imageIndex: 0,
					complete: function(image) {
						priv.bandwidth_count.call(speedtest, options, image)
						for (var i = 1, l = priv.images.length; i < l; i++) {
							priv.bandwidth_unit({
								imageIndex: i,
								complete: function(image) {
									priv.bandwidth_count.call(speedtest, options, image)
								}
							});
						}
						setTimeout(function() {
							if (priv.timedout) return;
							priv.timedout = true;
							if (priv.allow_timeout) {
								priv.cancelled = true;
								priv.bandwidth_complete.call(speedtest, options);
							}
						}, priv.min_timeout);
						setTimeout(function() {
							if (priv.cancelled) return;
							priv.cancelled = true;
							priv.bandwidth_complete.call(speedtest, options);
						}, priv.max_timeout);
					}
				});
				
			}
					
		},

		bandwidth_unit: function(imageOptions) {
			function load() {
				var finish = (new Date()).getTime();
				image.error = false;
				image.milliseconds = finish-start;
				imageOptions.complete.call(speedtest, image);
			}
			function error() {
				var finish = (new Date()).getTime();
				image.error = true;
				image.milliseconds = 100000000;
				imageOptions.complete.call(speedtest, image);
			}

			var image = priv.images[imageOptions.imageIndex];
			var img = document.createElement("img");
			var start = (new Date()).getTime();

			$.one(img, "load", load);
			$.one(img, "error", error);

			priv.imgs.push(img);
			img.setAttribute("src", image.url + "?t="+start);			
		},

		bandwidth_count: function(options, image, force) {
			options.completedCount++;

			if (image.error) {
				priv.overall_milliseconds = 0;
				priv.received_bytes = 0;

				priv.bytes_per_millisecond = 0;
				return priv.bandwidth_complete(options);
			}

			if (image.type === "overhead") {
				priv.overhead_milliseconds = image.milliseconds;
				return;
			}

			priv.allow_timeout = true;

			if (image.type === "reset") {
				priv.overall_milliseconds = 0;
				priv.received_bytes = 0;
			}

			var milliseconds = image.milliseconds - priv.overhead_milliseconds;
			if (milliseconds < 0) {
				milliseconds = Math.abs(milliseconds);
			}

			priv.overall_milliseconds += milliseconds;
			priv.received_bytes += image.size;

			priv.bytes_per_millisecond = priv.received_bytes / priv.overall_milliseconds;

			if (priv.timedout) return priv.bandwidth_complete(options);

			if (image.type === "minimum") {
				return;
			}
			
			if (options.completedCount === priv.images.length || force) {
				priv.bandwidth_complete(options);
			}
		},

		bandwidth_complete: function(options) {
			if (options.completed) return;
			options.completed = true;

			for (var i = 0, l = priv.imgs.length; i < l; i++) {
				var img = priv.imgs[i];
				$.off(img, "load", img._speedtestload);
				$.off(img, "error", img._speedtesterror);
				$.attr(img, "src","");	
			}

			priv.imgs = [];

			if (typeof options.complete === "function") {
				options.complete();
			}
		},

		onInteraction: function() {
			var now = (new Date()).getTime();

			var immediate = false;
			if (now - priv.last_interaction > speedtest.min_timeout) {
				immediate = true;
			}

			priv.last_interaction = now;

			clearTimeout(priv.interaction_timeout);
			priv.interaction_timeout = setTimeout(priv.finishChangeTimeout, speedtest.config.idle_timeout);

			priv.startChangeTimeout(immediate);
		}

	};


//INITIALIZATION
	overlay(speedtest.config, {
		imagesURL: null, //location of sample images
		interval: 20000, // milliseconds between checks (20sec)
		sample_age: 60000, // take lowest speed in latest timeslice (1min)
		idle_timeout: 60000, // time before idle state (1min)
		offline_threshold_kbps: 0,
		slow_threshold_kbps: 1000,
		no_wait_for_document: false
	});

	$.on(document, "click", priv.onInteraction);
	$.on(document, "keyup", priv.onInteraction);
	$.on(document, "scroll", $.debounce(priv.onInteraction, 250));

	$.onDocumentLoaded(function() {
		$.domloaded = true;
	}, speedtest.config.no_wait_for_document);

	var cookie = Cookie.get("speedtest");
	if (cookie) {
		//restore previous class on load

		cookie = JSON.parse(cookie);
		speedtest.low_name = cookie.low_name;
		speedtest.low_kbps = cookie.low_kbps;

		$.addClass($.html, "speedtest-"+speedtest.low_name);

	} else {
		//start slow

		speedtest.low_name = "slow";
		speedtest.low_kbps = 25;
		$.addClass($.html, "speedtest-slow");
	}

})();
define("extensions/adapt-speedtest/js/speedtest.min", function(){});

define('extensions/adapt-speedtest/js/adapt-speedtest',[
    'coreJS/adapt',
    './speedtest.min',
],function(Adapt, SpeedTest) {

    speedtest.config({
        imagesURL: "assets/speedtest",
        no_wait_for_document: 1,
        interval: 20000, // milliseconds between checks (20sec)
        sample_age: 60000, // take lowest speed in latest timeslice (1min)
        idle_timeout: 60000, // time before idle state (1min)
        offline_threshold_kbps: 0,
        slow_threshold_kbps: 2000,
    });

    Adapt.once('configModel:dataLoaded', function(view) {

        if (Adapt.config.get("_speedtest") && Adapt.config.get("_speedtest")._isEnabled === false) {
            speedtest.low_kbps = speedtest.kbps = 100000000;
            speedtest.low_name = speedtest.name = "fast";
            $("html").removeClass("speedtest-slow").addClass("speedtest-fast");
            console.log("speedtest disabled", speedtest.name, speedtest.kbps);
            return;
        }

        var url = document.createElement("a");
        url.href = window.location.href;
        if (url.search.indexOf("speedtest=slow") > -1) {
            speedtest.low_kbps = speedtest.kbps = 400;
            speedtest.low_name = speedtest.name = "slow";
            $("html").addClass("speedtest-slow").removeClass("speedtest-fast");
            console.log("speedtest force", speedtest.name, speedtest.kbps);
            return;
        } else if (url.search.indexOf("speedtest=fast") > -1) {
            speedtest.low_kbps = speedtest.kbps = 100000000;
            speedtest.low_name = speedtest.name = "fast";
            $("html").removeClass("speedtest-slow").addClass("speedtest-fast");
            console.log("speedtest force", speedtest.name, speedtest.kbps);
            return;
        }


        Adapt.config.set('_canLoadData', false);

        var continued = false;

        speedtest.onchange(function(name, kbps) {
            console.log("speedtest", name, kbps);

            Adapt.trigger("network:change", name, kbps);

            if (continued) return;
            continued = true;
            _.defer(function() {
                Adapt.trigger('configModel:loadCourseData');
            });
        },{
            immediate: true, // (default: true) callback once bound
            on_rate_change: true  // (default: false) callback on kbps change and connection name change
        });

    });

});

define('extensions/adapt-tutor/js/tutorOverlay',[
	'coreJS/adapt'
], function(Adapt) {


	var TutorOverlay = Backbone.View.extend({

		events: {
			"click .close-button, .close-button-text": "onCloseClick"
		},

		initialize: function () {
			this._onTutorOpened = _.bind(this.onTutorOpened, this);
			this._onTutorClosed = _.bind(this.onTutorClosed, this);
			this.listenTo(Adapt, "remove", this._onTutorClosed);
			this.listenTo(Adapt, "close", this._onTutorClosed);
			this.render();
		},

		render: function() {
			var alertObject = {
                title: this.model.get("feedbackTitle"),
                body: this.model.get("feedbackMessage"),
                _feedback: this.model.get("_feedback")
            };

			var $componentInner = this.$(".component-inner");
			var $tutorOvelay = $(Handlebars.templates["tutor-overlay"](alertObject));
            $componentInner.append($tutorOvelay);

            $tutorOvelay.find(".tutor-overlay").velocity("stop").velocity({
            	"opacity": 0
            }, {
            	"duration": 0,
            	"display": "block"
            }).velocity({
            	"opacity": 1
            }, {
            	"duration": 600,
            	"complete": this._onTutorOpened
            });

		},

		onTutorOpened: function() {
			Adapt.trigger("popup:opened", this.$(".tutor-overlay"));
		},

		onTutorClosed: function() {
            		
    		this.$(".tutor-container").remove();
    		Adapt.trigger("popup:closed");

    		this.stopListening();
    		this.undelegateEvents();


    	},

		onCloseClick: function(e) {
			e.preventDefault();
			e.stopPropagation();
			this.$(".tutor-overlay").velocity("stop").velocity({
            	"opacity": 0
            }, {
            	"duration": 600,
            	"complete": this._onTutorClosed
            });
		}

	});

	return TutorOverlay;

});
/*
 * adapt-contrib-tutor
 * License - http://github.com/adaptlearning/adapt_framework/blob/master/LICENSE
 * Maintainers - Kevin Corry <kevinc@learningpool.com>, Daryl Hedley <darylhedley@hotmail.com>,
 *               Himanshu Rajotia <himanshu.rajotia@exultcorp.com>
 */
define('extensions/adapt-tutor/js/adapt-tutor',[
    'coreJS/adapt',
    './tutorOverlay'
],function(Adapt, TutorOverlay) {

    Adapt.on('questionView:showFeedback', function(view) {
        
        if (!view.model.get("_feedback")) return;
        
        switch (view.model.get("_feedback")._type) {
        case "overlay":

            var tutorOverlay = new TutorOverlay({model:view.model, el:view.el});

            break;
        case "notify":
        default:

            var alertObject = {
                title: view.model.get("feedbackTitle"),
                body: view.model.get("feedbackMessage")
            };

            if (view.model.has('_isCorrect')) {
                // Attach specific classes so that feedback can be styled.
                if (view.model.get('_isCorrect')) {
                    alertObject._classes = 'correct';
                } else {
                    if (view.model.has('_isAtLeastOneCorrectSelection')) {
                        // Partially correct feedback is an option.
                        alertObject._classes = view.model.get('_isAtLeastOneCorrectSelection')
                            ? 'partially-correct'
                            : 'incorrect';
                    } else {
                        alertObject._classes = 'incorrect';
                    }
                }
            }

            Adapt.once("notify:closed", function() {
                Adapt.trigger("tutor:closed");
            });

            Adapt.trigger('notify:popup', alertObject);

            Adapt.trigger('tutor:opened');
            
            break;
        }

    });

});

/*
* adapt-contrib-article-reveal
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Stuart Nicholls <stuart@stuartnicholls.com>, Mohammed Salamat Ali <Mohammed.SalamatAli@kineo.com>
*/
define('components/adapt-article-reveal/js/adapt-article-reveal',[
    'core/js/adapt'
], function(Adapt) {

    var ArticleRevealView = Backbone.View.extend({

        className: "article-reveal",

        events: {
            "click .article-reveal-open-button":"revealArticle",
            "click .article-reveal-close-button":"closeArticle"
        },

        initialize: function () {
			if (this.model.get('_articleReveal') && this.model.get('_articleReveal')._isEnabled) {
				this.render();
				this.setup();
				this.listenTo(Adapt, "remove", this.remove);
				this.listenTo(Adapt, 'device:changed', this.setDeviceSize);
				Adapt.on("page:scrollTo", _.bind(this.onProgressBarScrollTo, this));
			}
        },

        render: function () {
            var data = this.model.toJSON();
            var template = Handlebars.templates["adapt-article-reveal"];
            $(this.el).html(template(data)).prependTo('.' + this.model.get("_id"));

            var incomplete = this.model.findDescendants("components").where({_isComplete:false});
            if (incomplete.length === 0) this.setOpenButtonState();

            return this;
        },

        setup: function(event) {
            if (event) event.preventDefault();
            //prevent drag on buttons
            this.preventDrag();

            //hide articles
            var $articleInner = $("." + this.model.get("_id") + " > .article-inner ");

            var incomplete = this.model.findDescendants("components").where({_isComplete:false});
            if (incomplete.length > 0){
                $articleInner.css({display:"none"});

                //hide the components inside the article
                this.toggleisVisible( false );
            }
            this.setDeviceSize();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large' || Adapt.device.screenSize === 'medium') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false);
            }
            this.render();
        },

        setOpenButtonState: function() {
            this.$(".article-reveal-open-button").addClass('visited show');
            this.$(".article-reveal-close-button").addClass('show');
        },

        setClosedButtonState: function() {
            this.$(".article-reveal-open-button").removeClass('show');
        },

        closeArticle: function(event) {
            if (event) event.preventDefault();

            this.setClosedButtonState();

            //animate Close..
            // this.$(".article-reveal-close-button").velocity("fadeOut", 500);

            //..and set components to isVisible false
            this.$el.siblings(".article-inner").velocity("slideUp", 600, _.bind(function() {
                this.toggleisVisible(false);
            }, this));
            this.$el.velocity("scroll", {
                duration: 600,
                offset: -$(".navigation").outerHeight()
            });
            this.$(".article-reveal-open-button").focus();
            this.$(".article-reveal-close-button").removeClass('show');
        },

        revealArticle: function(event) {
            if (event) event.preventDefault();
            if(this.$el.closest(".article").hasClass("locked")) return; // in conjunction with pageLocking

            this.setOpenButtonState();

            //animate reveal
            Adapt.trigger("article:revealing", this);
            this.$el.siblings(".article-inner").velocity("slideDown", 800, _.bind(function() {
                Adapt.trigger("article:revealed", this);
                // Call window resize to force components to rerender -
                // fixes components that depend on being visible for setting up layout
                $(window).resize();
            }, this));
            this.$el.velocity("scroll", {
                delay: 400,
                duration: 800,
                offset: this.$el.height() - $(".navigation").outerHeight()
            });
            // this.$(".article-reveal-close-button").velocity("fadeIn", {
            //     delay: 400,
            //     duration: 500
            // });

            //set components to isVisible true
            this.toggleisVisible(true);
        },

        /**
         * Toggles the visibility of the components inside the article
         */
        toggleisVisible: function(view) {
            var allComponents = this.model.findDescendants('components');
            allComponents.each(function(component) {
                component.setLocking("_isVisible", false);
                component.set('_isVisible', view, {
                    pluginName:"_articleReveal"
                });
            });
        },

        preventDrag: function() {
            $(".article-reveal-open-button").on("dragstart", function(event) {
                event.preventDefault();
            });
            $(".article-reveal-close-button").on("dragstart", function(event) {
                event.preventDefault();
            });
        },

        // Handles the Adapt page scrollTo event
        onProgressBarScrollTo: function(componentSelector) {
            if (typeof componentSelector == "object") componentSelector = componentSelector.selector;
            var allComponents = this.model.findDescendants('components');
            var componentID = componentSelector;
            if(componentID.indexOf('.') === 0) componentID = componentID.slice(1);
            allComponents.each(_.bind(function(component){
                if(component.get('_id') === componentID && !component.get('_isVisible')){
                    this.revealComponent(componentSelector);
                    return;
                }
            }, this));
        },

        revealComponent: function(componentSelector) {
            this.setOpenButtonState();

            this.toggleisVisible(true);

            $("." + this.model.get("_id") + " > .article-inner ").slideDown(0);

            this.$(".article-reveal-close-button").fadeIn(1);

            $(window).scrollTo($(componentSelector), {
                offset:{
                    top:-$('.navigation').height()
                }
            }).resize();
        }

    });

    Adapt.on('articleView:postRender', function(view) {
        if (view.model.get("_articleReveal")) {
            new ArticleRevealView({
                model:view.model
            });
        }
    });

});

define('components/adapt-articleBlockSlider/js/adapt-articleView',[
    'coreJS/adapt',
    'coreViews/articleView'
], function(Adapt, AdaptArticleView) {

    var BlockSliderView = {

        _disableAnimationOnce: false,
        _disableAnimations: false,

        events: {
            "click [data-block-slider]": "_onBlockSliderClick"
        },

        preRender: function() {

            AdaptArticleView.prototype.preRender.call(this);
            if (this.model.isBlockSliderEnabled()) this._blockSliderPreRender();

        },

        _blockSliderPreRender: function() {
            this._disableAnimations = $('html').is(".ie8") || $('html').is(".iPhone.version-7\\.0");
            this._blockSliderSetupEventListeners();
        },

        _blockSliderSetupEventListeners: function() {

            this._onBlockSliderResize = _.bind(this._onBlockSliderResize, this);
            this._blockSliderResizeHeight = _.bind(this._blockSliderResizeHeight, this);

            this.listenTo(Adapt, "device:resize", this._onBlockSliderResize);
            this.listenTo(Adapt, "device:changed", this._onBlockSliderDeviceChanged);
            
            this.listenToOnce(Adapt, "remove", this._onBlockSliderRemove);
            this.listenToOnce(this.model, "change:_isReady", this._onBlockSliderReady);

            this.listenTo(Adapt, "page:scrollTo", this._onBlockSliderPageScrollTo);
            this.listenTo(Adapt, "page:scrolledTo", this._onBlockSliderPageScrolledTo);

        },

        render: function() {

            if (this.model.isBlockSliderEnabled()) {

                this._blockSliderRender();

            } else AdaptArticleView.prototype.render.call(this);
        
        },

        _blockSliderRender: function() {
            Adapt.trigger(this.constructor.type + 'View:preRender', this);
          
            this._blockSliderConfigureVariables();

            var data = this.model.toJSON();
            var template = Handlebars.templates['articleBlockSlider-article'];
            this.$el.html(template(data));

            this.addChildren();

            _.defer(_.bind(function() {
                this._blockSliderPostRender();

            }, this));

            this.$el.addClass('article-block-slider-enabled');

            this.delegateEvents();

            return this;
        },

        _blockSliderConfigureVariables: function() {
            var blocks = this.model.getChildren().models;
            var totalBlocks = blocks.length;

            this.model.set("_currentBlock", 0);
            this.model.set("_totalBlocks", totalBlocks);

            var itemButtons = [];

            for (var i = 0, l = totalBlocks; i < l; i++) {
                itemButtons.push({
                    _className: (i === 0 ? "home" : "not-home") + (" i"+i),
                    _index: i,
                    _includeNumber: i != 0,
                    _title: blocks[i].get('title')
                });
            }

            this.model.set("_itemButtons", itemButtons);
        },

        _blockSliderConfigureControls: function(animate) {

            var duration = this.model.get("_articleBlockSlider")._slideAnimationDuration || 200;

            if (this._disableAnimationOnce) animate = false;
            if (this._disableAnimations) animate = false;

            var _currentBlock = this.model.get("_currentBlock");
            var _totalBlocks = this.model.get("_totalBlocks");

            var $left = this.$el.find("[data-block-slider='left']");
            var $right = this.$el.find("[data-block-slider='right']");

            if (_currentBlock === 0) {
                $left.a11y_cntrl_enabled(false);
                $right.a11y_cntrl_enabled(true);
            } else if (_currentBlock == _totalBlocks - 1 ) {
                $left.a11y_cntrl_enabled(true);
                $right.a11y_cntrl_enabled(false);
            } else {
                $left.a11y_cntrl_enabled(true);
                $right.a11y_cntrl_enabled(true);
            }

            var $indexes = this.$el.find("[data-block-slider='index']");
            $indexes.a11y_cntrl_enabled(true).removeClass("selected");
            $indexes.eq(_currentBlock).a11y_cntrl_enabled(false).addClass("selected visited");

            var $blocks = this.$el.find(".block");

            $blocks.a11y_on(false).eq(_currentBlock).a11y_on(true);
            
            _.delay(_.bind(function() {
                if ($blocks.eq(_currentBlock).onscreen().onscreen) $blocks.eq(_currentBlock).a11y_focus();
            }, this), duration);

        },

        _blockSliderSetButtonLayout: function() {
            var buttonsLength = this.model.get('_itemButtons').length;
            var itemwidth = 100 / buttonsLength;
            this.$('.item-button').css({
                width: itemwidth + '%'
            });
        },

        _blockSliderPostRender: function() {
            this._blockSliderConfigureControls(false);

            

            if (this.model.get("_articleBlockSlider")._hasTabs) {
                var parentHeight = this.$('.item-button').parent().height();
                this.$('.item-button').css({
                    height: parentHeight + 'px'
                });

                var toolbarHeight = this.$('.article-block-toolbar').height();
                var additionalMargin = '30';
                this.$('.article-block-toolbar').css({
                    top: '-' + (toolbarHeight + (additionalMargin/2)) + 'px'
                });

                var toolbarMargin = parseFloat(toolbarHeight) + parseFloat(additionalMargin);
                this.$('.article-block-slider').css({
                    marginTop: toolbarMargin + 'px'
                });
                this._blockSliderSetButtonLayout();
            }

            this._onBlockSliderDeviceChanged();

            var startIndex = this.model.get("_articleBlockSlider")._startIndex || 0;

            this._blockSliderMoveIndex(startIndex, false);

            Adapt.trigger(this.constructor.type + 'View:postRender', this);
            
        },

        _onBlockSliderReady: function() {
            this._blockSliderHideOthers();
            _.delay(_.bind(function(){
                this._blockSliderConfigureControls(false);
            },this),250);
            this.$(".component").on("resize", this._blockSliderResizeHeight);
        },

        _onBlockSliderClick: function(event) {
            event.preventDefault();

            var id = $(event.currentTarget).attr("data-block-slider");

            switch(id) {
            case "left":
                this._blockSliderMoveLeft();
                break;
            case "index":
                var index = parseInt($(event.currentTarget).attr("data-block-slider-index"));
                this._blockSliderMoveIndex(index);
                break;
            case "right":
                this._blockSliderMoveRight();
                break;
            }

        },

        _blockSliderMoveLeft: function() {
            if (this.model.get("_currentBlock") === 0) return;

            var index = this.model.get("_currentBlock");
            index--;
            this._blockSliderMoveIndex(index);
        },

        _blockSliderMoveIndex: function(index, animate) {
            if (this.model.get("_currentBlock") != index) {

                this.model.set("_currentBlock", index);
                this._blockSliderSetVisible(this.model.getChildren().models[index], true);

                this._blockSliderResizeHeight(animate);
                this._blockSliderScrollToCurrent(animate);
                this._blockSliderConfigureControls(animate);
            }

            var duration = this.model.get("_articleBlockSlider")._slideAnimationDuration || 200;

            if (this._disableAnimationOnce) animate = false;
            if (this._disableAnimations) animate = false;

            if (animate !== false) {
                _.delay(function() {
                    $(window).resize();
                }, duration);
            } else {
                $(window).resize();
            }
        },

        _blockSliderMoveRight: function() {
            if (this.model.get("_currentBlock") == this.model.get("_totalBlocks") - 1 ) return;

            var index = this.model.get("_currentBlock");
            index++;
            this._blockSliderMoveIndex(index);
        },

        _blockSliderScrollToCurrent: function(animate) {
            var isEnabled = this._blockSliderIsEnabledOnScreenSizes();
            var $container = this.$el.find(".article-block-slider");

            if (!isEnabled) {
                return $container.scrollLeft(0);
            }

            var blocks = this.$el.find(".block");
            var blockWidth = $(blocks[0]).outerWidth();
            var totalLeft = this.model.get("_currentBlock") * blockWidth;

            this._blockSliderShowAll();

            var duration = this.model.get("_articleBlockSlider")._slideAnimationDuration || 200;

            var currentBlock = this.model.get("_currentBlock")
            var $currentBlock = $(blocks[currentBlock]);

            if (this._disableAnimationOnce) animate = false;
            if (this._disableAnimations) animate = false;
            
            if (animate === false) {
                _.defer(_.bind(function(){
                    $container.scrollLeft(totalLeft );
                    this._blockSliderHideOthers();
                }, this));
            } else {
                $container.stop(true).animate({scrollLeft:totalLeft}, duration, _.bind(function() {
                    $container.scrollLeft(totalLeft );
                    this._blockSliderHideOthers();
                }, this));
            }

        },

        _blockSliderIsEnabledOnScreenSizes: function() {
            var isEnabledOnScreenSizes = this.model.get("_articleBlockSlider")._isEnabledOnScreenSizes;

            var sizes = isEnabledOnScreenSizes.split(" ");
            if (_.indexOf(sizes, Adapt.device.screenSize) > -1) {
                return true;
            }
            return false;
        },

        _blockSliderShowAll: function() {
            var blocks = this.model.getChildren().models;
            var currentIndex = this.model.get("_currentBlock");

            for (var i = 0, l = blocks.length; i < l; i++) {
                this._blockSliderSetVisible(blocks[i], true);
            }
        },
        
        _blockSliderHideOthers: function() {
            var blocks = this.model.getChildren().models;
            var currentIndex = this.model.get("_currentBlock");

            for (var i = 0, l = blocks.length; i < l; i++) {
                if (i != currentIndex) {
                    this._blockSliderSetVisible(blocks[i], false);
                } else {
                    this._blockSliderSetVisible(blocks[i], true);
                }
            }

        },

        _blockSliderSetVisible: function(model, value) {
            var id = model.get("_id");

            this.$el.find("."+id + " *").css("visibility", value ? "" : "hidden");

        },

        _onBlockSliderResize: function() {
            
            this._blockSliderResizeWidth(false);
            this._blockSliderResizeHeight(false);
            this._blockSliderScrollToCurrent(false);

        },

        _blockSliderResizeHeight: function(animate) {
            var $container = this.$el.find(".article-block-slider");
            var isEnabled = this._blockSliderIsEnabledOnScreenSizes();

            if (!isEnabled) {
                this._blockSliderShowAll();
                return $container.velocity("stop").css({"height": "", "min-height": ""});
            }

            var currentBlock = this.model.get("_currentBlock");
            var $blocks = this.$el.find(".block");

            var currentHeight = $container.height();
            var blockHeight = $blocks.eq(currentBlock).height();

            var maxHeight = -1;
            $container.find(".block").each(function() { 
            
            if ($(this).height() > maxHeight)
                maxHeight = $(this).height();
            });

            var duration = (this.model.get("_articleBlockSlider")._heightAnimationDuration || 200) * 2;

            if (this._disableAnimationOnce) animate = false;
            if (this._disableAnimations) animate = false;

            if (this.model.get("_articleBlockSlider")._hasUniformHeight) {
                if (animate === false) {
                    $container.css({"height": maxHeight+"px"});
                } else {
                    $container.velocity("stop").velocity({"height": maxHeight+"px"}, {duration: duration });//, easing: "ease-in"});
                }
            } else if (currentHeight <= blockHeight) {

                if (animate === false) {
                    $container.css({"height": blockHeight+"px"});
                } else {
                    $container.velocity("stop").velocity({"height": blockHeight+"px"}, {duration: duration });//, easing: "ease-in"});
                }

            } else if (currentHeight > blockHeight) {

                if (animate === false) {
                    $container.css({"height": blockHeight+"px"});
                } else {
                    $container.velocity("stop").velocity({"height": blockHeight+"px"}, {duration: duration });//, easing: "ease-in"});
                }

            }

            var minHeight = this.model.get("_articleBlockSlider")._minHeight;
            if (minHeight) {
                $container.css({"min-height": minHeight+"px"});
            }
        },

        _blockSliderResizeWidth: function() {
            var isEnabled = this._blockSliderIsEnabledOnScreenSizes();
            var $blockContainer = this.$el.find(".block-container");
            var $blocks = this.$el.find(".block");

            if (!isEnabled) {
                $blocks.css("width", "");
                return $blockContainer.css({"width": "100%"});
            }

            var $container = this.$el.find(".article-block-slider");

            $blocks.css("width", $container.width()+"px");
                
            var blockWidth = $($blocks[0]).outerWidth();
            var totalWidth = $blocks.length * (blockWidth);

            $blockContainer.width(totalWidth + "px");

        },

        _onBlockSliderDeviceChanged: function() {
            var isEnabled = this._blockSliderIsEnabledOnScreenSizes();

            if (isEnabled) {
                this.$(".article-block-toolbar, .article-block-bottombar").removeClass("display-none")
            } else {
                this.$(".article-block-toolbar, .article-block-bottombar").addClass("display-none");
            }

            _.delay(function() {
                $(window).resize();
            }, 250);
        },

        _onBlockSliderPageScrollTo: function(selector) {
            this._disableAnimationOnce = true;
            _.defer(_.bind(function() {
                this._disableAnimationOnce = false;
            }, this));

            if (typeof selector === "object") selector = selector.selector;

            var isEnabled = this._blockSliderIsEnabledOnScreenSizes();
            if (!isEnabled) {
                return;
            }

            if (this.$el.find(selector).length == 0) return;
            
            var id = selector.substr(1);

            var model = Adapt.findById(id);
            if (!model) return;

            var block;
            if (model.get("_type") == "block") block = model;
            else block = model.findAncestor("blocks");
            if (!block) return;

            var children = this.model.getChildren();
            for (var i = 0, item; item = children.models[i++];) {
                if (item.get("_id") == block.get("_id")) {
                    _.defer(_.bind(function() {
                        this._blockSliderMoveIndex(i-1, false);
                    }, this));
                    return;
                }
            }

        },

        _onBlockSliderPageScrolledTo: function() {
            _.defer(_.bind(function() {
                this._blockSliderScrollToCurrent(false);
            }, this));
        },

        _onBlockSliderRemove: function() {
            this._blockSliderRemoveEventListeners();
        },

        _blockSliderRemoveEventListeners: function() {
            this.$(".component").off("resize", this._blockSliderResizeHeight);
            this.stopListening(Adapt, "device:changed", this._onBlockSliderDeviceChanged);
        }
    };

    return BlockSliderView;

});

define('components/adapt-articleBlockSlider/js/adapt-articleModel',[
	'coreJS/adapt'
], function(Adapt) {

	var BlockSliderModel = {

		isBlockSliderEnabled: function() {
			return this.get("_articleBlockSlider") && this.get("_articleBlockSlider")._isEnabled;
		}

	};

	return BlockSliderModel;
});

//https://github.com/cgkineo/jquery.resize 2016-09-30

(function() {

  if ($.fn.off.elementResizeOriginalOff) return;


  var orig = $.fn.on;
  $.fn.on = function () {
    if (arguments[0] !== "resize") return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));

    addResizeListener.call(this, (new Date()).getTime());

    return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
  };
  $.fn.on.elementResizeOriginalOn = orig;
  var orig = $.fn.off;
  $.fn.off = function () {
    if (arguments[0] !== "resize") return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));

    removeResizeListener.call(this, (new Date()).getTime());

    return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
  };
  $.fn.off.elementResizeOriginalOff = orig;

  var expando = $.expando;
  var expandoIndex = 0;

  function checkExpando(element) {
    if (!element[expando]) element[expando] = ++expandoIndex;
    }

  //element + event handler storage
  var resizeObjs = {};

  //jQuery element + event handler attachment / removal
  var addResizeListener = function(data) {
      checkExpando(this);
      var $item = $(this);
      var measure = getDimensions($item);
      resizeObjs[data.guid + "-" + this[expando]] = { 
        data: data, 
        $element: $item,
        _resizeData: measure.uniqueMeasurementId
      };
  };

  var removeResizeListener = function(data) {
    try { 
      delete resizeObjs[data.guid + "-" + this[expando]]; 
    } catch(e) {

    }
  };

  function checkLoopExpired() {
    if ((new Date()).getTime() - loopData.lastEvent > 1500) {
      stopLoop()
      return true;
    }
  }

  function resizeLoop () {
    if (checkLoopExpired()) return;

    var resizeHandlers = getEventHandlers("resize");

    if (resizeHandlers.length === 0) {
      //nothing to resize
      stopLoop();
      resizeIntervalDuration = 500;
      repeatLoop();
    } else {
      //something to resize
      stopLoop();
      resizeIntervalDuration = 250;
      repeatLoop();
    }

    if  (resizeHandlers.length > 0) {
      var items = resizeHandlers;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        triggerResize(item);
      }
    }

  }

  function getEventHandlers(eventName) {
    var items = [];
    
    switch (eventName) {
    case "resize":
      for (var k in resizeObjs) {
        items.push(resizeObjs[k]);
      }
      break;
    }

    return items;
  }

  function getDimensions($element) {
      var height = $element.outerHeight();
      var width = $element.outerWidth();

      return {
        uniqueMeasurementId: height+","+width
      };
  }

  function triggerResize(item) {
    var measure = getDimensions(item.$element);
    //check if measure has the same values as last
    if (item._resizeData !== undefined && item._resizeData === measure.uniqueMeasurementId) return;
    item._resizeData = measure.uniqueMeasurementId;
    
    //make sure to keep listening until no more resize changes are found
    loopData.lastEvent = (new Date()).getTime();
    
    item.$element.trigger('resize');
  }


  //checking loop interval duration
  var resizeIntervalDuration = 250;

  var loopData = {
    lastEvent: 0,
    interval: null
  };

  //checking loop start and end
  function startLoop() {
    loopData.lastEvent = (new Date()).getTime();
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function repeatLoop() {
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function stopLoop() {
    clearInterval(loopData.interval);
    loopData.interval = null;
  }

  $('body').on("mousedown mouseup keyup keydown", startLoop);
  $(window).on("resize", startLoop);


})();

define("components/adapt-articleBlockSlider/js/lib/jquery.resize", function(){});

define('components/adapt-articleBlockSlider/js/adapt-articleExtension',[
	'coreJS/adapt',
	'coreViews/articleView',
	'coreModels/articleModel',
	'./adapt-articleView',
	'./adapt-articleModel',
	'./lib/jquery.resize'
], function(Adapt, ArticleView, ArticleModel, ArticleViewExtension, ArticleModelExtension) {

	/*	
		Here we are extending the articleView and articleModel in Adapt.
		This is to accomodate the block slider functionality on the article.
		The advantage of this method is that the block slider behaviour can utilize all of the predefined article behaviour in both the view and the model.
	*/	

	//Extends core/js/views/articleView.js
	var ArticleViewInitialize = ArticleView.prototype.initialize;
	ArticleView.prototype.initialize = function(options) {
		if (this.model.get("_articleBlockSlider")) {
			//extend the articleView with new functionality
			_.extend(this, ArticleViewExtension);
		}
		//initialize the article in the normal manner
		return ArticleViewInitialize.apply(this, arguments);
	};

	//Extends core/js/models/articleModel.js
	var ArticleModelInitialize = ArticleModel.prototype.initialize;
	ArticleModel.prototype.initialize = function(options) {
		if (this.get("_articleBlockSlider")) {
			//extend the articleModel with new functionality
			_.extend(this, ArticleModelExtension);

			//initialize the article in the normal manner
			var returnValue = ArticleModelInitialize.apply(this, arguments);

			return returnValue;
		}

		//initialize the article in the normal manner if no assessment
		return ArticleModelInitialize.apply(this, arguments);
	};

});
define('components/adapt-articleBlockSlider/js/articleBlockSlider',[
	'coreJS/adapt',
	'./adapt-articleExtension'
], function(Adapt) {

});
/*
 * adapt-audio
 * License - http://github.com/cgkineo/adapt_framework/LICENSE
 */
define('components/adapt-audio/js/adapt-audio',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var AudioView = Backbone.View.extend({

        className: "extension-audio",

        initialize: function() {
            this.render();
            this.listenTo(Adapt, 'audio', this.onAudioInvoked);
            this.listenTo(Adapt, 'audio:stop', this.onAudioStop);

            if (Modernizr.audio) {
                this.audio = new Audio();

                $(this.audio).on('ended', _.bind(this.onAudioEnded, this));
            } else if ($("#audioPlayer")[0] == undefined) {
                this.embedFlashAudioPlayer();
            }
        },

        render: function() {
            var template = Handlebars.templates["audio"]
            this.$el.html(template()).appendTo('#wrapper');
            return this;
        },

        embedFlashAudioPlayer: function() {

            window.onFlashAudioFinished = _.bind(this.onAudioEnded, this);

            var params = {
                swliveconnect: "true",
                allowscriptaccess: "always"
            };

            var attributes = {
                id: "audioPlayer",
                name: "audioPlayer"
            };

            swfobject.embedSWF("assets/audioplayer.swf", "flashPlayer", "1", "1", "8.0.22", "assets/express_install.swf", false, params, attributes);

            console.log($("#audioPlayer")[0]);
        },

        play: function() {
            try {
                if (this.audio) this.audio.play();
                else {
                    $("#audioPlayer")[0].loadAudio(this.$active.data('mp3'));
                }
            } catch (e) {
                console.error("play error");
            }
        },

        pause: function() {
            try {
                if (this.audio) this.audio.pause();
                else {
                    $("#audioPlayer")[0].controlAudio("pause");
                }
            } catch (e) {
                console.error("pause error");
            }
        },

        stop: function() {
            try {
                if (this.audio) {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                } else {
                    $("#audioPlayer")[0].controlAudio("pause");
                }
            } catch (e) {
                console.error("stop error");
            }
        },

        onAudioInvoked: function(el) {
            var $el = $(el);

            if (this.$active && this.$active.is($el)) {
                if (this.$active.hasClass('play')) {
                    this.$active.addClass('pause').removeClass('play');
                    this.play();
                } else {
                    this.$active.addClass('play').removeClass('pause');
                    this.pause();
                }
            } else {
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.pause();
                }

                this.$active = $el;
                this.$active.addClass('pause').removeClass('play');

                if (Modernizr.audio) {
                    if (this.audio.canPlayType('audio/ogg')) this.audio.src = this.$active.data('ogg');
                    if (this.audio.canPlayType('audio/mpeg')) this.audio.src = this.$active.data('mp3');
                }

                this.play();
            }
        },

        onAudioEnded: function() {
            if (this.$active) {
                this.$active.addClass('play').removeClass('pause');
            }
            this.stop();
        },

        onAudioStop: function(el) {

            if (el == null || el == undefined) {
                // console.log('stop any audio currently playing');
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.stop();
                }
            } else if (this.$active && (this.$active.is(el) || this.$active.parents(el).length > 0)) {
                // console.log('stop audio for specific element/descendents if currently playing');
                if (this.$active) {
                    this.$active.addClass('play').removeClass('pause');
                    this.stop();
                }
            }
        }
    });


    Adapt.once("app:dataLoaded", function() {
        new AudioView();
    });

    Adapt.on('router:location', function() {
        Adapt.trigger('audio:stop');
    });

});

define('components/adapt-backgroundScroll/js/adapt-backgroundScroll',['require','coreViews/componentView','coreJS/adapt'],function(require) {

	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');

	var BackgroundScroll = ComponentView.extend({

		events: {
			"click .bg-scroll-next": "nextItem"
		},

		preRender: function() {
			// Checks to see if the text should be reset on revisit
			this.viewHeight = $(window).height();
			if (this.model.get("_isComplete")) {
				this.setCompletionStatus();
			}
		},

		postRender: function() {
			this.offsetTop = $(".navigation").height();
			this.numItems = this.model.get("_items").length;
			this.$items = this.$(".bg-scroll-item");
			this.$images = this.$(".bg-scroll-background");
			this.visitedItems = 1;
			this.setupScrollListener();
			this.setupHeights();
			this.setReadyStatus();
			this.setupTimer();
		},

		setupTimer: function() {
			this.time = 0;
			this.timer = setInterval(function() {
				this.time++;
			}.bind(this), 1000);
		},

		setupScrollListener: function() {
			$(window).on("scroll", function() {
				var st = window.pageYOffset || document.documentElement.scrollTop;
				var top = this.$el.offset().top;
				var iStart = this.model.get("_fadeFirstImage") ? 0 : 1;
				var distanceFromBottom = st - (this.$el.height() + top - (this.viewHeight / 2));
				var distanceFromTop = st - (top - this.viewHeight);
				var opacity;
				var imgTop = 100;

				// Scroll the first image into view
				if (distanceFromTop > 0 && distanceFromTop < this.viewHeight) {
					imgTop = 100 - ((st - (top - this.viewHeight)) / this.viewHeight) * 100;
				} else if (distanceFromBottom > 0) {
					// Scroll last image when user reaches the bottom of the component
					imgTop = - (distanceFromBottom / this.viewHeight) * 100;
				} else if (distanceFromTop > this.viewHeight) {
					imgTop = 0;
				}

				this.$(".bg-scroll-images").css({top: imgTop + "%"});

				if (iStart === 1) {
					opacity = st + this.viewHeight >= top - 60 ? 1 : 0;
					this.$images[0].style.opacity = opacity;
				}

				for (var i = iStart; i < this.numItems; i++) {
					var item = this.$items.eq(i);
					var diff = item.offset().top - st - (this.viewHeight / 3);
					var img = this.$images[i];
					if (diff < 0) {
						var currItem = i;
						opacity = 1;
					} else if (diff < 400) {
						opacity = 1 - (diff / 400);
					} else {
						opacity = 0;
					}

					img.style.opacity = opacity;
				}

				if (currItem && currItem !== this.currItem) this.setCurrItem(currItem);
			}.bind(this));
		},

		setupHeights: function() {
			this.el.style.paddingBottom = this.viewHeight / 2 + "px";
			_.each(this.$items, function(el) {
				var $el = $(el);
				var padding = (this.viewHeight - $el.height()) / 2 + "px 0";
				$el.css({padding: padding});
			}, this);
		},

		setCurrItem: function(i) {
			// Prevent user from scrolling straight to bottom
			// 2 Seconds should be about right to ensure they have read the material
			if (this.time < 2) return;
			this.currItem = i;
			this.time = 0;
			this.visitedItems ++;
			if (this.checkCompletionStatus()) {
				this.onComplete();
			}
		},

		nextItem: function() {

		},

		prevItem: function() {

		},

		checkCompletionStatus: function() {
			return this.numItems === this.visitedItems;
		},

		onComplete: function () {
			this.setCompletionStatus();
		}
	});

	Adapt.register('backgroundScroll', BackgroundScroll);

	return BackgroundScroll;

});

define('components/adapt-blinds/js/adapt-blinds',['require','coreViews/componentView','coreJS/adapt'],function(require) {

	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');

	var Blinds = ComponentView.extend({

		preRender: function() {

			this.listenTo(Adapt, 'device:resize', this.calculateWidths, this);
			this.setDeviceSize();

			// Checks to see if the text should be reset on revisit
			this.checkIfResetOnRevisit();
		},

		postRender: function() {
			this.setReadyStatus();
			this.$('.blinds-inner').imageready(_.bind(function() {
				this.setupBlinds();
				this.setReadyStatus();
			}, this));

		},

		setupBlinds: function() {
			if(!this.model.has('_items') || !this.model.get('_items').length) return;
			this.model.set('_itemCount', this.model.get('_items').length);
			this.model.set('_active', true);
			this.calculateWidths();
			this.setupEventListeners();
		},

		setupEventListeners: function() {
			var that = this;
			var $items = this.$(".blinds-item");
			var _items = this.model.get("_items");
			var wItem = this.itemWidth;
			var animationTime = 400;
			var captionDelay = this.model.has("captionDelay") ? this.model.get("captionDelay") : 800;
			var expandBy = this.model.get("expandBy") || 2;
			var count = 0;
			var currentItem;
			var queue = [];

			$items.on({
				mouseenter: function() {
					currentItem = this;

					var $this = $(this);
					var itemIndex = $this.index();
					var _item = _items[itemIndex];
					var $siblings = $this.siblings();
					var $p = $this.find("p");
					var wItemNew = wItem * expandBy;
					var wSiblingsNew = wItem - ((wItemNew - wItem) / $siblings.length);
					var currTop = 10;

					$this.outerWidth(wItemNew);

					that.setStage(itemIndex);

					$p.each(function(i, el) {
						(function(i, el) {
							var t = animationTime + (i * captionDelay);
							var caption = _item.captions[i];
							var left = caption.left || _item.left || 0;
							var top = caption.top;
							if (!top && i === 0) top = 0;
							var width = caption.width || wItem * expandBy + "px";
							queue[i] = setTimeout(function() {
								if (top === undefined) {
									top = $p.eq(i - 1).outerHeight() + currTop + 10;
								}
								currTop = parseInt(top);
								$(el).css({
									opacity: 1,
									top: top,
									left: left,
									maxWidth: width
								});
							}, t);
						})(i, el);
					});
					$siblings.outerWidth(wSiblingsNew);
				},
				mouseleave: function() {
					for (var i = 0; i < queue.length; i++) {
						clearTimeout(queue[i]);
					}
					currentItem = null;
					count = 0;
					var $this = $(this);
					$this.outerWidth(wItem);
					$this.find("p").css("opacity", 0);
					$this.siblings().outerWidth(wItem);
				}
			});

			this.completionEvent = this.model.get('_setCompletionOn') || 'allItems';

			if (this.completionEvent !== 'inview' && this.model.get('_items').length > 1) {
				this.on(this.completionEvent, _.bind(this.onCompletion, this));
			} else {
				this.$('.component-widget').on('inview', _.bind(this.inview, this));
			}
		},

		calculateWidths: function() {
			if (this.model.get("height")) this.$(".blinds-item").height(this.model.get("height"));
			var wTotal = this.$(".blinds-container").width();
			var $items = this.$(".blinds-item");
			var margin = parseInt($items.css("marginRight"));
			var wItem = (wTotal / $items.length) - (margin * 2);
			this.itemWidth = wItem;
			$items.outerWidth(wItem);
		},

		// Used to check if the text should reset on revisit
		checkIfResetOnRevisit: function() {
			var isResetOnRevisit = this.model.get('_isResetOnRevisit');

			// If reset is enabled set defaults
			if (isResetOnRevisit) {
				this.model.reset(isResetOnRevisit);
			}
		},

		setStage: function(stage) {
			this.model.set('_stage', stage);
			if (this.model.get('_isDesktop')) {
				// Set the visited attribute for large screen devices
				var currentItem = this.getCurrentItem(stage);
				currentItem._isVisited = true;
			}

			this.evaluateCompletion();
		},

		getCurrentItem: function(index) {
			return this.model.get('_items')[index];
		},

		getVisitedItems: function() {
			return _.filter(this.model.get('_items'), function(item) {
				return item._isVisited;
			});
		},

		evaluateCompletion: function() {
			if (this.getVisitedItems().length === this.model.get('_items').length) {
				this.trigger('allItems');
			}
		},

		inview: function(event, visible, visiblePartX, visiblePartY) {
			if (visible) {
				if (visiblePartY === 'top') {
					this._isVisibleTop = true;
				} else if (visiblePartY === 'bottom') {
					this._isVisibleBottom = true;
				} else {
					this._isVisibleTop = true;
					this._isVisibleBottom = true;
				}

				if (this._isVisibleTop && this._isVisibleBottom) {
					this.$('.component-inner').off('inview');
					this.setCompletionStatus();
				}
			}
		},

		onCompletion: function() {
			this.setCompletionStatus();
			if (this.completionEvent && this.completionEvent != 'inview') {
				this.off(this.completionEvent, this);
			}
		},

		setDeviceSize: function() {
			if (Adapt.device.screenSize === 'large') {
				this.$el.addClass('desktop').removeClass('mobile');
				this.model.set('_isDesktop', true);
			} else {
				this.$el.addClass('mobile').removeClass('desktop');
				this.model.set('_isDesktop', false)
			}
		}

	});

	Adapt.register('blinds', Blinds);

	return Blinds;

});

define('components/adapt-contrib-accordion/js/adapt-contrib-accordion',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Accordion = ComponentView.extend({

        events: {
            'click .accordion-item-title': 'toggleItem'
        },

        toggleSpeed: 200,

        preRender: function() {
            // Checks to see if the accordion should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setReadyStatus();
        },

        // Used to check if the accordion should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);

                _.each(this.model.get('_items'), function(item) {
                    item._isVisited = false;
                });
            }
        },

        toggleItem: function(event) {
            event.preventDefault();

            var $toggleButton = $(event.currentTarget);
            var $accordionItem = $toggleButton.parent('.accordion-item');
            var isCurrentlyExpanded = $toggleButton.hasClass('selected');

            if (this.model.get('_shouldCollapseItems') === false) {
                // Close and reset the selected Accordion item only
                this.closeItem($accordionItem);
            } else {
                // Close and reset all Accordion items
                var allAccordionItems = this.$('.accordion-item');
                var count = allAccordionItems.length;
                for (var i = 0; i < count; i++) {
                    this.closeItem($(allAccordionItems[i]));
                }
            }

            if (!isCurrentlyExpanded) {
                this.openItem($accordionItem);
            }
        },

        closeItem: function($itemEl) {
            if (!$itemEl) {
                return false;
            }

            var $body = $('.accordion-item-body', $itemEl).first();
            var $button = $('button', $itemEl).first();
            var $icon = $('.accordion-item-title-icon', $itemEl).first();

            $body.stop(true, true).slideUp(this.toggleSpeed);
            $button.removeClass('selected');
            $button.attr('aria-expanded', false);
            $icon.addClass('icon-plus');
            $icon.removeClass('icon-minus');
        },

        openItem: function($itemEl) {
            if (!$itemEl) {
                return false;
            }

            var $body = $('.accordion-item-body', $itemEl).first();
            var $button = $('button', $itemEl).first();
            var $icon = $('.accordion-item-title-icon', $itemEl).first();

            $body = $body.stop(true, true).slideDown(this.toggleSpeed, function() {
                $body.a11y_focus();
            });

            $button.addClass('selected');
            $button.attr('aria-expanded', true);

            this.setVisited($itemEl.index());
            $button.addClass('visited');

            $icon.removeClass('icon-plus');
            $icon.addClass('icon-minus');
        },

        setVisited: function(index) {
            var item = this.model.get('_items')[index];
            item._isVisited = true;
            this.checkCompletionStatus();
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        checkCompletionStatus: function() {
            if (this.getVisitedItems().length == this.model.get('_items').length) {
                this.setCompletionStatus();
            }
        }

    });

    Adapt.register('accordion', Accordion);

    return Accordion;

});

define('components/adapt-contrib-assessmentResults/js/adapt-contrib-assessmentResults',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var AssessmentResults = ComponentView.extend({

        events: {
            'inview': 'onInview',
            'click .results-retry-button button': 'onRetry'
        },

        preRender: function () {
            if (this.model.setLocking) this.model.setLocking("_isVisible", false);

            this.saveOriginalTexts();

            this.setupEventListeners();
            this.setupModelResetEvent();
            this.checkIfComplete();
            this.checkIfVisible();
        },

        saveOriginalTexts: function() {
            this.model.set({
                "originalTitle": this.model.get("title"),
                "originalBody": this.model.get("body"),
                "originalInstruction": this.model.get("instruction")
            });
        },

        checkIfVisible: function() {
            
            if (!Adapt.assessment) {
                return false;
            }

            var isVisibleBeforeCompletion = this.model.get("_isVisibleBeforeCompletion") || false;
            var isVisible = false;

            var wasVisible = this.model.get("_isVisible");

            var assessmentModel = Adapt.assessment.get(this.model.get("_assessmentId"));
            if (!assessmentModel || assessmentModel.length === 0) return;

            var state = assessmentModel.getState();
            var isComplete = state.isComplete;
            var isAttemptInProgress = state.attemptInProgress;
            var attemptsSpent = state.attemptsSpent;
            var hasHadAttempt = (!isAttemptInProgress && attemptsSpent > 0);
            
            isVisible = (isVisibleBeforeCompletion && !isComplete) || hasHadAttempt;

            if (!wasVisible && isVisible) isVisible = false;

            this.model.set('_isVisible', isVisible, {pluginName: "assessmentResults"});
        },

        checkIfComplete: function() {
            
            if (!Adapt.assessment) {
                return false;
            }

            var assessmentModel = Adapt.assessment.get(this.model.get("_assessmentId"));
            if (!assessmentModel || assessmentModel.length === 0) return;

            var state = assessmentModel.getState();
            var isComplete = state.isComplete;
            if (isComplete) {
                this.onAssessmentsComplete(state);
            } else {
                this.model.reset('hard', true);
            }
        },

        setupModelResetEvent: function() {
            if (this.model.onAssessmentsReset) return;
            this.model.onAssessmentsReset = function(state) {
                if (this.get("_assessmentId") === undefined || 
                    this.get("_assessmentId") != state.id) return;

                this.reset('hard', true);
            };
            this.model.listenTo(Adapt, 'assessments:reset', this.model.onAssessmentsReset);
        },

        postRender: function() {
            this.setReadyStatus();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, 'assessments:complete', this.onAssessmentsComplete);
            this.listenToOnce(Adapt, 'remove', this.onRemove);
        },

        removeEventListeners: function() {
            this.stopListening(Adapt, 'assessments:complete', this.onAssessmentsComplete);
            this.stopListening(Adapt, 'remove', this.onRemove);
        },

        onAssessmentsComplete: function(state) {
            if (this.model.get("_assessmentId") === undefined || 
                this.model.get("_assessmentId") != state.id) return;

            this.model.set("_state", state);
            
            var feedbackBand = this.getFeedbackBand();
            
            this.setFeedback(feedbackBand);
            
            this.addClassesToArticle(feedbackBand);

            this.render();
            
            this.show();
        },

        onAssessmentComplete: function(state) {
            this.model.set("_state", state);
            
            var feedbackBand = this.getFeedbackBand();
            
            this.setFeedback(feedbackBand);
            
            this.addClassesToArticle(feedbackBand);

            this.render();
            
            this.show();
        },

        onInview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }
                
                if (this._isVisibleTop || this._isVisibleBottom) {
                    this.setCompletionStatus();
                    this.$el.off("inview");
                }
            }
        },

        onRetry: function() {
            var state = this.model.get("_state");
            var assessmentModel = Adapt.assessment.get(state.id);

            this.restoreOriginalTexts();

            assessmentModel.reset();
        },

        restoreOriginalTexts: function() {
            this.model.set({
                "title": this.model.get("originalTitle"),
                "body": this.model.get("originalBody"),
                "instruction": this.model.get("originalInstruction")
            });
        },
        
        show: function() {
             if(!this.model.get('_isVisible')) {
                 this.model.set('_isVisible', true, {pluginName: "assessmentResults"});
             }
        },

        setFeedback: function(feedbackBand) {

            var completionBody = this.model.get("_completionBody");

            var state = this.model.get("_state");
            state.feedbackBand = feedbackBand;
            state.feedback = feedbackBand.feedback;

            this.checkRetryEnabled();

            completionBody = this.stringReplace(completionBody, state);

            this.model.set("body", completionBody);

        },
        
        /**
         * If there are classes specified for the feedback band, apply them to the containing article
         * This allows for custom styling based on the band the user's score falls into
         */
        addClassesToArticle: function(feedbackBand) {
            
            if(!feedbackBand.hasOwnProperty('_classes')) return;
            
            this.$el.parents('.article').addClass(feedbackBand._classes);
        },

        getFeedbackBand: function() {
            var state = this.model.get("_state");
            var scoreProp = state.isPercentageBased ? 'scoreAsPercent' : 'score';
            var bands = _.sortBy(this.model.get("_bands"), '_score');
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (state[scoreProp] >= bands[i]._score) {
                    return bands[i];
                }
            }

            return "";
        },

        checkRetryEnabled: function() {
            var state = this.model.get("_state");

            var assessmentModel = Adapt.assessment.get(state.id);
            if (!assessmentModel.canResetInPage()) return false;

            var isRetryEnabled = state.feedbackBand._allowRetry !== false;
            var isAttemptsLeft = (state.attemptsLeft > 0 || state.attemptsLeft === "infinite");

            var showRetry = isRetryEnabled && isAttemptsLeft;
            this.model.set("_isRetryEnabled", showRetry);

            if (showRetry) {
                var retryFeedback =  this.model.get("_retry").feedback;
                retryFeedback = this.stringReplace(retryFeedback, state);
                this.model.set("retryFeedback", retryFeedback);
            } else {
                this.model.set("retryFeedback", "");
            }
        },

        stringReplace: function(string, context) {
            //use handlebars style escaping for string replacement
            //only supports unescaped {{{ attributeName }}} and html escaped {{ attributeName }}
            //will string replace recursively until no changes have occured

            var changed = true;
            while (changed) {
                changed = false;
                for (var k in context) {
                    var contextValue = context[k];

                    switch (typeof contextValue) {
                    case "object":
                        continue;
                    case "number":
                        contextValue = Math.floor(contextValue);
                        break;
                    }

                    var regExNoEscaping = new RegExp("((\\{\\{\\{){1}[\\ ]*"+k+"[\\ ]*(\\}\\}\\}){1})","g");
                    var regExEscaped = new RegExp("((\\{\\{){1}[\\ ]*"+k+"[\\ ]*(\\}\\}){1})","g");

                    var preString = string;

                    string = string.replace(regExNoEscaping, contextValue);
                    var escapedText = $("<p>").text(contextValue).html();
                    string = string.replace(regExEscaped, escapedText);

                    if (string != preString) changed = true;

                }
            }

            return string;
        },

        onRemove: function() {
            if (this.model.unsetLocking) this.model.unsetLocking("_isVisible");

            this.removeEventListeners();
        }
        
    }, {
        template: 'assessmentResults'
    });
    
    Adapt.register("assessmentResults", AssessmentResults);
    
    return AssessmentResults;
});

define('components/adapt-contrib-blank/js/adapt-contrib-blank',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Blank = ComponentView.extend({


        preRender: function() {
            this.$el.addClass("no-state");
            // Checks to see if the blank should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setReadyStatus();
            this.$('.component-inner').on('inview', _.bind(this.inview, this));
        },

        // Used to check if the blank should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }

            }
        }

    });

    Adapt.register('blank', Blank);

    return Blank;

});

define('components/adapt-contrib-slider/js/adapt-contrib-slider',[
  'coreViews/questionView',
  'coreJS/adapt',
  'libraries/rangeslider'
], function(QuestionView, Adapt, Rangeslider) {

    var Slider = QuestionView.extend({

        tempValue:true,

        events: {
            'click .slider-scale-number': 'onNumberSelected',
            'focus input[type="range"]':'onHandleFocus',
            'blur input[type="range"]':'onHandleBlur'
        },

        // Used by the question to reset the question when revisiting the component
        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled();
            this.deselectAllItems();
            this.resetQuestion();
        },

        // Used by question to setup itself just before rendering
        setupQuestion: function() {
            if(!this.model.get('_items')) {
                this.setupModelItems();
            }

            this.restoreUserAnswers();
            if (this.model.get('_isSubmitted')) return;

            this.selectItem(0, true);
        },

        setupRangeslider: function () {
            this.$sliderScaleMarker = this.$('.slider-scale-marker');
            this.$slider = this.$('input[type="range"]');

            if(this.model.has('_scaleStep')) {
                this.$slider.attr({"step": this.model.get('_scaleStep')});
            }

            this.$slider.rangeslider({
                polyfill: false,
                onSlide: _.bind(this.handleSlide, this)
            });
            this.oldValue = 0;

            if (this._deferEnable) {
                this.setAllItemsEnabled();
            }
        },

        handleSlide: function (position, value) {
            if (this.oldValue === value) {
               return;
            }
            if(this.model.get('_marginDir') == 'right'){
                if(this.tempValue && (this.model.get('_userAnswer') == undefined)){
                    value = this.model.get('_items').length - value + 1;
                    this.tempValue = false;
                    var tempPixels = this.mapIndexToPixels(value);
                    var rangeSliderWidth = this.$('.rangeslider').width();
                    var handleLeft = parseInt(this.$('.rangeslider__handle').css('left'));
                    var sliderWidth = this.$('.rangeslider__fill').width();
                    handleLeft = rangeSliderWidth - handleLeft -this.$('.rangeslider__handle').width();
                    sliderWidth = rangeSliderWidth - sliderWidth;
                    this.$('.rangeslider__handle').css('left',handleLeft);
                    this.$('.rangeslider__fill').width(sliderWidth);
                }
            }
            var itemIndex = this.getIndexFromValue(value);
            var pixels = this.mapIndexToPixels(itemIndex);
            this.selectItem(itemIndex, false);
            this.animateToPosition(pixels);
            this.oldValue = value;
            this.tempValue = true;
        },

        setupModelItems: function() {
            var items = [];
            var answer = this.model.get('_correctAnswer');
            var range = this.model.get('_correctRange');
            var start = this.model.get('_scaleStart');
            var end = this.model.get('_scaleEnd');
            var step = this.model.get('_scaleStep') || 1;

            for (var i = start; i <= end; i += step) {
                if (answer) {
                    items.push({value: i, selected: false, correct: (i == answer)});
                } else {
                    items.push({value: i, selected: false, correct: (i >= range._bottom && i <= range._top)});
                }
            }

            this.model.set('_items', items);
            this.model.set('_marginDir', (Adapt.config.get('_defaultDirection') === 'rtl' ? 'right' : 'left'));
        },

        restoreUserAnswers: function() {
            if (!this.model.get('_isSubmitted')) {
                this.model.set({
                    _selectedItem: {},
                    _userAnswer: undefined
                });
                return;
            };

            var items = this.model.get('_items');
            var userAnswer = this.model.get('_userAnswer');
            for (var i = 0, l = items.length; i < l; i++) {
                var item = items[i];
                if (item.value == userAnswer) {
                    this.model.set('_selectedItem', item);
                    this.selectItem(this.getIndexFromValue(item.value), true);
                    break;
                }
            }

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
        },

        // Used by question to disable the question during submit and complete stages
        disableQuestion: function() {
            this.setAllItemsEnabled();
        },

        // Used by question to enable the question during interactions
        enableQuestion: function() {
            this.setAllItemsEnabled();
        },

        setAllItemsEnabled: function() {
            var isEnabled = this.model.get('_isEnabled');

            if (this.$slider) {
                if (isEnabled) {
                    this.$('.slider-widget').removeClass('disabled');
                    this.$slider.prop('disabled', false);
                    this.$slider.rangeslider('update', true);

                } else {
                    this.$('.slider-widget').addClass('disabled');
                    this.$slider.prop('disabled', true);
                    this.$slider.rangeslider('update', true);
                }
            } else {
                this._deferEnable = true; // slider is not yet ready
            }
        },

        // Used by question to setup itself just after rendering
        onQuestionRendered: function() {
            this.setupRangeslider();
            this.setScalePositions();
            this.onScreenSizeChanged();
            this.showScaleMarker(true);
            this.listenTo(Adapt, 'device:resize', this.onScreenSizeChanged);
            this.setAltText(this.model.get('_scaleStart'));
            this.setReadyStatus();
        },

        // this should make the slider handle, slider marker and slider bar to animate to give position
        animateToPosition: function(newPosition) {
            if (!this.$sliderScaleMarker) return;

                this.$sliderScaleMarker
                  .velocity('stop')
                  .velocity({
                    left: newPosition
                  }, {
                    duration: 200,
                    easing: "linear"
                  });
        },

        // this shoud give the index of item using given slider value
        getIndexFromValue: function(itemValue) {
            var scaleStart = this.model.get('_scaleStart'),
                scaleEnd = this.model.get('_scaleEnd');
            return Math.floor(this.mapValue(itemValue, scaleStart, scaleEnd, 0, this.model.get('_items').length - 1));
        },

        // this should set given value to slider handle
        setAltText: function(value) {
            this.$('.slider-handle').attr('aria-valuenow', value);
        },

        mapIndexToPixels: function(value, $widthObject) {
            var numberOfItems = this.model.get('_items').length,
                width = $widthObject ? $widthObject.width() : this.$('.slider-scaler').width();

            return Math.round(this.mapValue(value, 0, numberOfItems - 1, 0, width));
        },

        mapPixelsToIndex: function(value) {
            var numberOfItems = this.model.get('_items').length,
                width = this.$('.slider-sliderange').width();

            return Math.round(this.mapValue(value, 0, width, 0, numberOfItems - 1));
        },

        normalise: function(value, low, high) {
            var range = high - low;
            return (value - low) / range;
        },

        mapValue: function(value, inputLow, inputHigh, outputLow, outputHigh) {
            var normal = this.normalise(value, inputLow, inputHigh);
            return normal * (outputHigh - outputLow) + outputLow;
        },

        onHandleFocus: function(event) {
            event.preventDefault();
            this.$slider.on('keydown', _.bind(this.onKeyDown, this));
        },

        onHandleBlur: function(event) {
            event.preventDefault();
            this.$slider.off('keydown');
        },

        onKeyDown: function(event) {
            if(event.which == 9) return; // tab key
            event.preventDefault();

            var newItemIndex = this.getIndexFromValue(this.model.get('_selectedItem').value);

            switch (event.which) {
                case 40: // ↓ down
                case 37: // ← left
                    newItemIndex = Math.max(newItemIndex - 1, 0);
                    break;
                case 38: // ↑ up
                case 39: // → right
                    newItemIndex = Math.min(newItemIndex + 1, this.model.get('_items').length - 1);
                    break;
            }

            this.selectItem(newItemIndex);
            if(typeof newItemIndex == 'number') this.showScaleMarker(true);
            this.animateToPosition(this.mapIndexToPixels(newItemIndex));
            this.setSliderValue(this.getValueFromIndex(newItemIndex));
            this.setAltText(this.getValueFromIndex(newItemIndex));
        },

        onNumberSelected: function(event) {
            event.preventDefault();
            this.tempValue = false;

            if (this.model.get('_isInteractionComplete')) {
              return;
            }

            // when component is not reset, selecting a number should be prevented
            if (this.$slider.prop('disabled')) {
              return;
            }

            var itemValue = parseInt($(event.currentTarget).attr('data-id'));
            var index = this.getIndexFromValue(itemValue);
            this.selectItem(index);
            this.animateToPosition(this.mapIndexToPixels(index));
            this.setAltText(itemValue);
            this.setSliderValue(itemValue)
        },

        getValueFromIndex: function(index) {
          return this.model.get('_items')[index].value;
        },

        resetControlStyles: function() {
            this.$('.slider-handle').empty();
            this.showScaleMarker(false);
            this.$('.slider-bar').animate({width:'0px'});
            this.setSliderValue(this.model.get('_items')[0].value);
        },

        /**
        * allow the user to submit immediately; the slider handle may already be in the position they want to choose
        */
        canSubmit: function() {
            return true;
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {},

        //This preserves the state of the users answers for returning or showing the users answer
        storeUserAnswer: function() {
            this.model.set('_userAnswer', this.model.get('_selectedItem').value);
        },

        isCorrect: function() {
            var numberOfCorrectAnswers = 0;

            _.each(this.model.get('_items'), function(item, index) {
                if(item.selected && item.correct)  {
                    this.model.set('_isAtLeastOneCorrectSelection', true);
                    numberOfCorrectAnswers++;
                }
            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);

            return this.model.get('_isAtLeastOneCorrectSelection') ? true : false;
        },

        // Used to set the score based upon the _questionWeight
        setScore: function() {
            var numberOfCorrectAnswers = this.model.get('_numberOfCorrectAnswers');
            var questionWeight = this.model.get('_questionWeight');
            var score = questionWeight * numberOfCorrectAnswers;
            this.model.set('_score', score);
        },

        setSliderValue: function (value) {
          if (this.$slider) {
            this.$slider.val(value).change();
          }
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            if (!this.model.get('_canShowMarking')) return;

            this.$('.slider-widget').removeClass('correct incorrect')
                .addClass(this.model.get('_selectedItem').correct ? 'correct' : 'incorrect');
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        // Used by the question view to reset the stored user answer
        resetUserAnswer: function() {
            this.model.set({
                _selectedItem: {},
                _userAnswer: undefined
            });
        },

        // Used by the question view to reset the look and feel of the component.
        // This could also include resetting item data
        resetQuestion: function() {
            this.selectItem(0, true);
            this.animateToPosition(0);
            this.resetControlStyles();
            this.showScaleMarker(true);
            this.setAltText(this.model.get('_scaleStart'));
        },

        setScalePositions: function() {
            var numberOfItems = this.model.get('_items').length;
            _.each(this.model.get('_items'), function(item, index) {
                var normalisedPosition = this.normalise(index, 0, numberOfItems -1);
                this.$('.slider-scale-number').eq(index).data('normalisedPosition', normalisedPosition);
            }, this);
        },

        showScale: function () {
            this.$('.slider-markers').empty();
            if (this.model.get('_showScale') === false) {
                this.$('.slider-markers').eq(0).css({display: 'none'});
                this.model.get('_showScaleIndicator')
                    ? this.$('.slider-scale-numbers').eq(0).css({visibility: 'hidden'})
                    : this.$('.slider-scale-numbers').eq(0).css({display: 'none'});
            } else {
                var $scaler = this.$('.slider-scaler');
                var $markers = this.$('.slider-markers');
                for (var i = 0, count = this.model.get('_items').length; i < count; i++) {
                    $markers.append("<div class='slider-line component-item-color'>");
                    $('.slider-line', $markers).eq(i).css({left: this.mapIndexToPixels(i, $scaler) + 'px'});
                }
                var scaleWidth = $scaler.width(),
                    $numbers = this.$('.slider-scale-number');
                for (var i = 0, count = this.model.get('_items').length; i < count; i++) {
                    var $number = $numbers.eq(i),
                        newLeft = Math.round($number.data('normalisedPosition') * scaleWidth);
                    if($('html').hasClass('ie9') && this.model.get('_marginDir')=='right'){
						$number.css({right: newLeft});
					}
					else{
						$number.css({left: newLeft});
                    }
                }
            }
        },

        //Labels are enabled in slider.hbs. Here we manage their containing div.
        showLabels: function () {
            if(!this.model.get('labelStart') && !this.model.get('labelEnd')) {
                this.$('.slider-scale-labels').eq(0).css({display: 'none'});
            }
        },

        remapSliderBar: function() {
            var $scaler = this.$('.slider-scaler');
            var currentIndex = this.getIndexFromValue(this.model.get('_selectedItem').value);
            var left = this.mapIndexToPixels(currentIndex, $scaler);
            this.$('.slider-handle').css({left: left + 'px'});
            this.$('.slider-scale-marker').css({left: left + 'px'});
            this.$('.slider-bar').width(left);
            //updated position of rangeslider bar on window resize for RTL 
            if (this.model.get('_marginDir') == 'right') {
                _.delay(function() {
                    this.$('.rangeslider__handle').css('left', left);
                    this.$('.rangeslider__fill').css('width', left + (this.$('.rangeslider__handle').width() / 2));
                }, 300, this);
            }
        },

        onScreenSizeChanged: function() {
            this.showScale();
            this.showLabels();
            this.remapSliderBar();
            if (this.$('.slider-widget').hasClass('show-user-answer')) {
                this.hideCorrectAnswer();
            } else if (this.$('.slider-widget').hasClass('show-correct-answer')) {
                this.showCorrectAnswer();
            }
        },

        showCorrectAnswer: function() {
            var answers = [];

            if(this.model.has('_correctAnswer')) {
                var correctAnswer = this.model.get('_correctAnswer');
            }

            if (this.model.has('_correctRange')) {
                var bottom = this.model.get('_correctRange')._bottom;
                var top = this.model.get('_correctRange')._top;
                var step = (this.model.has('_scaleStep') ? this.model.get('_scaleStep') : 1);
            }

            this.showScaleMarker(false);

            //are we dealing with a single correct answer or a range?
            if (correctAnswer) {
                answers.push(correctAnswer);
            } else if (bottom !== undefined && top !== undefined) {
                var answer = this.model.get('_correctRange')._bottom;
                var topOfRange = this.model.get('_correctRange')._top;
                while(answer <= topOfRange) {
                    answers.push(answer);
                    answer += step;
                }
            } else {
                console.log("adapt-contrib-slider::WARNING: no correct answer or correct range set in JSON")
            }

            var middleAnswer = answers[Math.floor(answers.length / 2)];
            this.animateToPosition(this.mapIndexToPixels(this.getIndexFromValue(middleAnswer)));

            this.showModelAnswers(answers);

            this.setSliderValue(middleAnswer);
        },

        showModelAnswers: function(correctAnswerArray) {
            var $parentDiv = this.$('.slider-modelranges');
            _.each(correctAnswerArray, function(correctAnswer, index) {
                $parentDiv.append($("<div class='slider-model-answer component-item-color component-item-text-color'>"));

                var $element = $(this.$('.slider-modelranges .slider-model-answer')[index]),
                    startingLeft = this.mapIndexToPixels(this.getIndexFromValue(this.model.get('_selectedItem').value));

                if(this.model.get('_showNumber')) $element.html(correctAnswer);

                $element.css({left:startingLeft}).fadeIn(0, _.bind(function() {
                    $element.animate({left: this.mapIndexToPixels(this.getIndexFromValue(correctAnswer))});
                }, this));
            }, this);
        },

        // Used by the question to display the users answer and
        // hide the correct answer
        // Should use the values stored in storeUserAnswer
        hideCorrectAnswer: function() {
            var userAnswerIndex = this.getIndexFromValue(this.model.get('_userAnswer'));
            this.$('.slider-modelranges').empty();

            this.showScaleMarker(true);
            this.selectItem(userAnswerIndex, true);
            this.animateToPosition(this.mapIndexToPixels(userAnswerIndex));
            this.setSliderValue(this.model.get('_userAnswer'));
        },

        // according to given item index this should make the item as selected
        selectItem: function(itemIndex, noFocus) {
            this.$el.a11y_selected(false);
            _.each(this.model.get('_items'), function(item, index) {
                item.selected = (index == itemIndex);
                if(item.selected) {
                    this.model.set('_selectedItem', item);
                    this.$('.slider-scale-number[data-id="'+item.value+'"]').a11y_selected(true, noFocus);
                }
            }, this);
            this.showNumber(true);
        },

        // this should reset the selected state of each item
        deselectAllItems: function() {
            _.each(this.model.get('_items'), function(item) {
                item.selected = false;
            }, this);
        },

        // this makes the marker visible or hidden
        showScaleMarker: function(show) {
            var $scaleMarker = this.$('.slider-scale-marker');
            if (this.model.get('_showScaleIndicator')) {
                this.showNumber(show);
                if(show) {
                    $scaleMarker.addClass('display-block');
                } else {
                    $scaleMarker.removeClass('display-block');
                }
            }
        },

        // this should add the current slider value to the marker
        showNumber: function(show) {
            var $scaleMarker = this.$('.slider-scale-marker');
            if(this.model.get('_showNumber')) {
                if(show) {
                    $scaleMarker.html(this.model.get('_selectedItem').value);
                } else {
                    $scaleMarker.html = "";
                }
            }
        },

        /**
        * Used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
        */
        getResponse:function() {
            return this.model.get('_userAnswer').toString();
        },

        /**
        * Used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
        */
        getResponseType:function() {
            return "numeric";
        }

    });

    Adapt.register('slider', Slider);

    return Slider;
});

define('components/adapt-contrib-confidenceSlider/js/adapt-contrib-confidenceSlider',[
    'components/adapt-contrib-slider/js/adapt-contrib-slider',
    'core/js/adapt'
], function(Slider, Adapt) {

    var ConfidenceSlider = Slider.extend({

        /* override */
        preRender:function() {
            this.model.set('_isEnabled', true);
            Slider.prototype.preRender.apply(this, arguments);
        },

        /* override */
        setupDefaultSettings: function() {
            Slider.prototype.setupDefaultSettings.apply(this, arguments);
            this.model.set('_canShowModelAnswer', false);
            if (!this.model.has('_attempts') || this.model.get('_attempts') > 1) this.model.set('_attempts', 1);
        },

        /* override */
        setupQuestion: function() {
            if (this.model.get('_linkedToId')) {
                this._setupLinkedModel();
                this.listenTo(Adapt, "buttonsView:postRender", this.onButtonsRendered);
            }
            Slider.prototype.setupQuestion.apply(this, arguments);
        },

        /* override */
        disableQuestion: function() {
            if (this.model.get('_isReady')) this.setAllItemsEnabled(false);
            if (this.model.has('_linkedModel')) this.$('.buttons-action').a11y_cntrl_enabled(false);
        },

        /* override */
        enableQuestion: function() {
            if (this.model.get('_isReady')) this.setAllItemsEnabled(true);
            if (this.model.has('_linkedModel')) this.$('.buttons-action').a11y_cntrl_enabled(true);
        },

        /* override to indicate that all options are correct */
        setupModelItems: function() {
            var items = [];
            var start = this.model.get('_scaleStart');
            var end = this.model.get('_scaleEnd');
            var step = this.model.get('_scaleStep') || 1;

            for (var i = start; i <= end; i += step) {
                items.push({value: i, selected: false, correct: true});
            }

            this.model.set('_items', items);
            this.model.set('_marginDir', (Adapt.config.get('_defaultDirection') === 'rtl' ? 'right' : 'left'));
        },

        /* override */
        restoreUserAnswers: function() {
            if (!this.model.get('_isSubmitted')) {
                this.model.set({
                    _selectedItem: {},
                    _userAnswer: undefined
                });
                return;
            }

            // this is only necessary to avoid an issue when using adapt-devtools
            if (!this.model.has('_userAnswer')) this.model.set('_userAnswer', this.model.get('_items')[0].value);

            Slider.prototype.restoreUserAnswers.apply(this, arguments);
        },

        /* override */
        canSubmit: function() {
            return !this.model.has('_linkedModel') || this.model.get('_linkedModel').get('_isSubmitted');
        },

        /* override */
        setupFeedback: function(){
            this.model.set('feedbackTitle', this.model.get('title'));
            this.model.set('feedbackMessage', this._getFeedbackString());
        },

        /* override */
        updateButtons: function() {
            if (this.model.get('_attempts') > 0) {
                Slider.prototype.updateButtons.apply(this, arguments);
            }
            else {
                this.model.set('_buttonState', this.model.get('_isEnabled') ? 'submit' : 'reset');
            }

        },

        _setupLinkedModel: function() {
            var linkedModel = Adapt.components.findWhere({_id: this.model.get('_linkedToId')});
            this.model.set({
                '_showNumber':linkedModel.get('_showNumber'),
                '_showScaleIndicator':linkedModel.get('_showScaleIndicator'),
                '_showScale':linkedModel.get('_showScale'),
                'labelStart':linkedModel.get('labelStart'),
                'labelEnd':linkedModel.get('labelEnd'),
                '_scaleStart':linkedModel.get('_scaleStart'),
                '_scaleEnd':linkedModel.get('_scaleEnd')
            });
            this.model.set('_linkedModel', linkedModel);
            if (this.model.get('_attempts') < 0) linkedModel.set('_attempts', 1);
        },

        _listenToLinkedModel: function() {
            this.listenTo(this.model.get('_linkedModel'), 'change:_selectedItem', this.onLinkedConfidenceChanged);
            this.listenTo(this.model.get('_linkedModel'), 'change:_isSubmitted', this.onLinkedSubmittedChanged);
        },

        _updateLinkedConfidenceIndicator: function() {
            var lm = this.model.get('_linkedModel');
            var linkedValue = 0;
            var rangeslider = this.$slider.data('plugin_rangeslider');

            //if (lm.get('_isSubmitted')) {
                linkedValue = lm.has('_userAnswer') ? lm.get('_userAnswer') : lm.get('_selectedItem').value;
            //}

            if (linkedValue == this.model.get('_scaleEnd')) {
                this.$('.linked-confidence-bar').css({width: '100%'});
            }
            else {
                // follow rangeslider setPosition method
                this.$('.linked-confidence-bar').css({width: (rangeslider.getPositionFromValue(linkedValue) + rangeslider.grabPos) + 'px'});
            }
        },

        _getFeedbackString: function() {
            var feedbackSeparator = this.model.get('_feedback').feedbackSeparator,
                genericFeedback = this._getGenericFeedback(),
                comparisonFeedback = this.model.has('_linkedModel') && this.model.get('_linkedModel').get('_isSubmitted') ? this._getComparisonFeedback() : null,
                thresholdFeedback = this._getThresholdFeedback(),
                needsSeparator = false,
                feedbackString = "";

            if (genericFeedback) {
                feedbackString += genericFeedback;
                needsSeparator = true;
            }
            if (comparisonFeedback) {
                if(needsSeparator) feedbackString += feedbackSeparator;
                feedbackString += comparisonFeedback;
                needsSeparator = true;
            }
            if (thresholdFeedback) {
                if(needsSeparator) feedbackString += feedbackSeparator;
                feedbackString += thresholdFeedback;
            }

            return feedbackString;

        },

        _getGenericFeedback: function() {
            return this.model.get('_feedback').generic;
        },

        _getComparisonFeedback: function() {
            var lm = this.model.get('_linkedModel'),
                confidence = this.model.get('_selectedItem').value,
                linkedConfidence = lm.has('_userAnswer') ? lm.get('_userAnswer') : lm.get('_selectedItem').value,
                feedbackString;
            if (linkedConfidence < confidence) {
                feedbackString = this.model.get('_feedback')._comparison.higher;
            } else if (linkedConfidence > confidence) {
                feedbackString = this.model.get('_feedback')._comparison.lower;
            } else {
                feedbackString = this.model.get('_feedback')._comparison.same;
            }
            return feedbackString;
        },

        _getThresholdFeedback: function() {
            var feedbackList = this.model.get('_feedback')._threshold;

            if (!feedbackList) return;

            var confidenceValue = this.model.get('_selectedItem').value;

            for (var i = 0, j = feedbackList.length; i < j; i++) {
                var feedback = feedbackList[i];
                var values = feedback._values;

                if (confidenceValue >= values._low && confidenceValue <= values._high) {
                    return feedback.text;
                }
            }
        },

        _getTrackingData:function() {
            if (this.model.get('_isInteractionComplete') === false || this.model.get('_isComplete') === false) {
                return null;
            }

            var hasUserAnswer = (this.model.get('_userAnswer') !== undefined);
            var isUserAnswerArray = (this.model.get('_userAnswer') instanceof Array);

            var numericParameters = [
                    this.model.get('_score') || 0,
                    this.model.get('_attemptsLeft') || 0
                ];

            var booleanParameters = [
                    hasUserAnswer ? 1 : 0,
                    isUserAnswerArray ? 1 : 0,
                    this.model.get('_isInteractionComplete') ? 1 : 0,
                    this.model.get('_isSubmitted') ? 1 : 0,
                    this.model.get('_isCorrect') ? 1 : 0
                ];

            var data = [
                numericParameters,
                booleanParameters
            ];


            if (hasUserAnswer) {
                var userAnswer = isUserAnswerArray ? this.model.get('_userAnswer') : [this.model.get('_userAnswer')];

                data.push(userAnswer);
            }

            return data;
        },

        _updateTracking:function() {
            // should we track this component?
            if (this.model.get('_shouldStoreResponses')) {
                // is tracking is enabled?
                if (Adapt.config.has('_spoor') && Adapt.config.get('_spoor')._isEnabled) {
                    // if spoor is handling response tracking we don't need to do anything
                    if (!Adapt.config.get('_spoor')._tracking._shouldStoreResponses) {
                        // otherwise write custom tracking data
                        Adapt.offlineStorage.set(this.model.get('_id'), this._getTrackingData());
                    }
                }
            }
        },

        onQuestionRendered: function() {
            Slider.prototype.onQuestionRendered.apply(this, arguments);

            if (this.model.has('_linkedModel')) {
                this.$('.rangeslider').prepend($('<div class="linked-confidence-bar"/>'));
                this._listenToLinkedModel();
                if (this.model.get('_linkedModel').get('_isSubmitted')) {
                    this.onLinkedConfidenceChanged();
                } else {
                    this.model.set('_isEnabled', false);
                    this.$('.component-body-inner').html(this.model.get('disabledBody'));
                }
            }

            if (this.model.get('_isSubmitted') && this.model.has('_userAnswer')) {
                this.model.set('feedbackTitle', this.model.get('title'));
                this.model.set('feedbackMessage', this._getFeedbackString());
            }
        },

        onScreenSizeChanged: function() {
            Slider.prototype.onScreenSizeChanged.apply(this, arguments);

            // if linked slider on same page update it with user interaction
            if (this.model.has('_linkedModel') && this.model.get('_linkedModel').get('_isReady')) {
                this._updateLinkedConfidenceIndicator();
            }
        },

        onResetClicked: function() {
            Slider.prototype.onResetClicked.apply(this, arguments);

            this.model.reset('hard', true);

            this._updateTracking();
        },

        onSubmitClicked: function() {
            Slider.prototype.onSubmitClicked.apply(this, arguments);

            this._updateTracking();
        },

        onButtonsRendered:function(buttonsView) {
            // necessary due to deferred ButtonsView::postRender
            if (this.buttonsView == buttonsView) {
                if (!this.model.get('_isEnabled')) {
                    if (!this.model.has('_linkedModel') || !this.model.get('_linkedModel').get('_isSubmitted')) {
                        this.$('.buttons-action').a11y_cntrl_enabled(false);
                    }
                }
            }
        },

        onLinkedConfidenceChanged: function() {
            this._updateLinkedConfidenceIndicator();
        },

        onLinkedSubmittedChanged: function(linkedModel) {
            if (linkedModel.get('_isSubmitted')) {
                this.model.set('_isEnabled', true);
            }
            else {
                this.model.set('_isEnabled', false);
            }
        }
    }, {
        template:'confidenceSlider'
    });
    
    Adapt.register("confidenceSlider", ConfidenceSlider);

    Adapt.on('app:dataReady', function() {
        // is tracking enabled?
        if (Adapt.config.has('_spoor') && Adapt.config.get('_spoor')._isEnabled) {
            // if spoor is handling response tracking we don't need to do anything
            if (!Adapt.config.get('_spoor')._tracking._shouldStoreResponses) {
                // ensure data is setup
                Adapt.offlineStorage.get();

                _.each(Adapt.components.where({'_component':'confidenceSlider', '_shouldStoreResponses':true}), function(confidenceSlider) {
                    var dataItem = Adapt.offlineStorage.get(confidenceSlider.get('_id'));

                    if (!dataItem) return;

                    var numericParameters = dataItem[0];
                    var booleanParameters = dataItem[1];

                    var score = numericParameters[0];
                    var attemptsLeft = numericParameters[1] || 0;

                    var hasUserAnswer = booleanParameters[0];
                    var isUserAnswerArray = booleanParameters[1];
                    var isInteractionComplete = booleanParameters[2];
                    var isSubmitted = booleanParameters[3];
                    var isCorrect = booleanParameters[4];

                    confidenceSlider.set("_isComplete", true);
                    confidenceSlider.set("_isInteractionComplete", isInteractionComplete);
                    confidenceSlider.set("_isSubmitted", isSubmitted);
                    confidenceSlider.set("_score", score);
                    confidenceSlider.set("_isCorrect", isCorrect);
                    confidenceSlider.set("_attemptsLeft", attemptsLeft);

                    if (hasUserAnswer) {
                        var userAnswer = dataItem[2];
                        if (!isUserAnswerArray) userAnswer = userAnswer[0];

                        confidenceSlider.set("_userAnswer", userAnswer);
                    }
                });
            }
        }
    });
    
    return ConfidenceSlider;
});

/*
 * adapt-contrib-flipcard
 * License - https://github.com/ExultCorp/adapt-contrib-flipcard/blob/master/LICENSE
 * Maintainers - Himanshu Rajotia <himanshu.rajotia@exultcorp.com>
 */
define('components/adapt-contrib-flipcard/js/adapt-contrib-flipcard',[
    'coreViews/componentView',
    'coreJS/adapt'
], function(ComponentView, Adapt) {

    var Flipcard = ComponentView.extend({

        events: {
            'click .flipcard-item': 'onClickFlipItem'
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:resize', this.reRender, this);
            this.checkIfResetOnRevisit();
        },

        // this is use to set ready status for current component on postRender.
        postRender: function() {
            if (!Modernizr.csstransforms3d) {
                this.$('.flipcard-item-back').hide();
            }

            this.$('.flipcard-widget').imageready(_.bind(function() {
                this.setReadyStatus();
                this.reRender();
            }, this));
        },

        // Used to check if the flipcard should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }

            _.each(this.model.get('_items'), function(item) {
                item._isVisited = false;
            });
        },

        // This function called on triggering of device resize and device change event of Adapt.
        reRender: function() {
            var imageHeight = this.$('.flipcard-item-frontImage').eq(0).height();
            if (imageHeight) {
                this.$('.flipcard-item').height(imageHeight);
            }
        },

        // Click or Touch event handler for flip card.
        onClickFlipItem: function(event) {
            if(event && event.target.tagName.toLowerCase() === 'a') {
                return;
            } else {
                event && event.preventDefault();
            }

            var $selectedElement = $(event.currentTarget);
            var flipType = this.model.get('_flipType');
            if (flipType === 'allFlip') {
                this.performAllFlip($selectedElement);
            } else if (flipType === 'singleFlip') {
                this.performSingleFlip($selectedElement);
            }
        },

        // This function will be responsible to perform All flip on flipcard
        // where all cards can flip and stay in the flipped state.
        performAllFlip: function($selectedElement) {
            if (!Modernizr.csstransforms3d) {
                var $frontflipcard = $selectedElement.find('.flipcard-item-front');
                var $backflipcard = $selectedElement.find('.flipcard-item-back');
                var flipTime = this.model.get('_flipTime') || 'fast';
                if ($frontflipcard.is(':visible')) {
                    $frontflipcard.fadeOut(flipTime, function() {
                        $backflipcard.fadeIn(flipTime);
                    });
                } else if ($backflipcard.is(':visible')) {
                    $backflipcard.fadeOut(flipTime, function() {
                        $frontflipcard.fadeIn(flipTime);
                    });
                }
            } else {
                $selectedElement.toggleClass('flipcard-flip');
            }

            var flipcardElementIndex = this.$('.flipcard-item').index($selectedElement);
            this.setVisited(flipcardElementIndex);
        },

        // This function will be responsible to perform Single flip on flipcard where
        // only one card can flip and stay in the flipped state.
        performSingleFlip: function($selectedElement) {
            var flipcardContainer = $selectedElement.closest('.flipcard-widget');
            if (!Modernizr.csstransforms3d) {
                var frontflipcard = $selectedElement.find('.flipcard-item-front');
                var backflipcard = $selectedElement.find('.flipcard-item-back');
                var flipTime = this.model.get('_flipTime') || 'fast';

                if (backflipcard.is(':visible')) {
                    backflipcard.fadeOut(flipTime, function() {
                        frontflipcard.fadeIn(flipTime);
                    });
                } else {
                    var visibleflipcardBack = flipcardContainer.find('.flipcard-item-back:visible');
                    if (visibleflipcardBack.length > 0) {
                        visibleflipcardBack.fadeOut(flipTime, function() {
                            flipcardContainer.find('.flipcard-item-front:hidden').fadeIn(flipTime);
                        });
                    }
                    frontflipcard.fadeOut(flipTime, function() {
                        backflipcard.fadeIn(flipTime);
                    });
                }
            } else {
                if ($selectedElement.hasClass('flipcard-flip')) {
                    $selectedElement.removeClass('flipcard-flip');
                } else {
                    flipcardContainer.find('.flipcard-item').removeClass('flipcard-flip');
                    $selectedElement.addClass('flipcard-flip');
                }
            }

            var flipcardElementIndex = this.$('.flipcard-item').index($selectedElement);
            this.setVisited(flipcardElementIndex);
        },

        // This function will set the visited status for particular flipcard item.
        setVisited: function(index) {
            var item = this.model.get('_items')[index];
            item._isVisited = true;
            this.checkCompletionStatus();
        },

        // This function will be used to get visited states of all flipcard items.
        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        // This function will check or set the completion status of current component.
        checkCompletionStatus: function() {
            if (this.getVisitedItems().length === this.model.get('_items').length) {
                this.setCompletionStatus();
            }
        }
    });

    Adapt.register('flipcard', Flipcard);

    return Flipcard;

});

define('components/adapt-contrib-mcq/js/adapt-contrib-mcq',['require','coreViews/questionView','coreJS/adapt'],function(require) {
    var QuestionView = require('coreViews/questionView');
    var Adapt = require('coreJS/adapt');

    var Mcq = QuestionView.extend({

        events: {
            'focus .mcq-item input':'onItemFocus',
            'blur .mcq-item input':'onItemBlur',
            'change .mcq-item input':'onItemSelected',
            'keyup .mcq-item input':'onKeyPress'
        },

        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled(true);
            this.resetQuestion();
        },

        setupQuestion: function() {
            // if only one answer is selectable, we should display radio buttons not checkboxes
            this.model.set("_isRadio", (this.model.get("_selectable") == 1) );
            
            this.model.set('_selectedItems', []);

            this.setupQuestionItemIndexes();

            this.setupRandomisation();
            
            this.restoreUserAnswers();
        },

        setupQuestionItemIndexes: function() {
            var items = this.model.get("_items");
            if (items && items.length > 0) {
                for (var i = 0, l = items.length; i < l; i++) {
                    if (items[i]._index === undefined) items[i]._index = i;
                }
            }
        },

        setupRandomisation: function() {
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                this.model.set("_items", _.shuffle(this.model.get("_items")));
            }
        },

        restoreUserAnswers: function() {
            if (!this.model.get("_isSubmitted")) return;

            var selectedItems = [];
            var items = this.model.get("_items");
            var userAnswer = this.model.get("_userAnswer");
            _.each(items, function(item, index) {
                item._isSelected = userAnswer[item._index];
                if (item._isSelected) {
                    selectedItems.push(item)
                }
            });

            this.model.set("_selectedItems", selectedItems);

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
        },

        disableQuestion: function() {
            this.setAllItemsEnabled(false);
        },

        enableQuestion: function() {
            this.setAllItemsEnabled(true);
        },

        setAllItemsEnabled: function(isEnabled) {
            _.each(this.model.get('_items'), function(item, index){
                var $itemLabel = this.$('label').eq(index);
                var $itemInput = this.$('input').eq(index);

                if (isEnabled) {
                    $itemLabel.removeClass('disabled');
                    $itemInput.prop('disabled', false);
                } else {
                    $itemLabel.addClass('disabled');
                    $itemInput.prop('disabled', true);
                }
            }, this);
        },

        onQuestionRendered: function() {
            this.setReadyStatus();
        },

        onKeyPress: function(event) {
            if (event.which === 13) { //<ENTER> keypress
                this.onItemSelected(event);
            }
        },

        onItemFocus: function(event) {
            if(this.model.get('_isEnabled') && !this.model.get('_isSubmitted')){
                $("label[for='"+$(event.currentTarget).attr('id')+"']").addClass('highlighted');
            }
        },
        
        onItemBlur: function(event) {
            $("label[for='"+$(event.currentTarget).attr('id')+"']").removeClass('highlighted');
        },

        onItemSelected: function(event) {
            if(this.model.get('_isEnabled') && !this.model.get('_isSubmitted')){
                var selectedItemObject = this.model.get('_items')[$(event.currentTarget).parent('.component-item').index()];
                this.toggleItemSelected(selectedItemObject, event);
            }
        },

        toggleItemSelected:function(item, clickEvent) {
            var selectedItems = this.model.get('_selectedItems');
            var itemIndex = _.indexOf(this.model.get('_items'), item),
                $itemLabel = this.$('label').eq(itemIndex),
                $itemInput = this.$('input').eq(itemIndex),
                selected = !$itemLabel.hasClass('selected');
            
                if(selected) {
                    if(this.model.get('_selectable') === 1){
                        this.$('label').removeClass('selected');
                        this.$('input').prop('checked', false);
                        this.deselectAllItems();
                        selectedItems[0] = item;
                    } else if(selectedItems.length < this.model.get('_selectable')) {
                     selectedItems.push(item);
                 } else {
                    clickEvent.preventDefault();
                    return;
                }
                $itemLabel.addClass('selected');
                $itemLabel.a11y_selected(true);
            } else {
                selectedItems.splice(_.indexOf(selectedItems, item), 1);
                $itemLabel.removeClass('selected');
                $itemLabel.a11y_selected(false);
            }
            $itemInput.prop('checked', selected);
            item._isSelected = selected;
            this.model.set('_selectedItems', selectedItems);
        },

        // check if the user is allowed to submit the question
        canSubmit: function() {
            var count = 0;

            _.each(this.model.get('_items'), function(item) {
                if (item._isSelected) {
                    count++;
                }
            }, this);

            return (count > 0) ? true : false;

        },

        // Blank method to add functionality for when the user cannot submit
        // Could be used for a popup or explanation dialog/hint
        onCannotSubmit: function() {},

        // This is important for returning or showing the users answer
        // This should preserve the state of the users answers
        storeUserAnswer: function() {
            var userAnswer = [];

            var items = this.model.get('_items').slice(0);
            items.sort(function(a, b) {
                return a._index - b._index;
            });

            _.each(items, function(item, index) {
                userAnswer.push(item._isSelected);
            }, this);
            this.model.set('_userAnswer', userAnswer);
        },

        isCorrect: function() {

            var numberOfRequiredAnswers = 0;
            var numberOfCorrectAnswers = 0;
            var numberOfIncorrectAnswers = 0;

            _.each(this.model.get('_items'), function(item, index) {

                var itemSelected = (item._isSelected || false);

                if (item._shouldBeSelected) {
                    numberOfRequiredAnswers ++;

                    if (itemSelected) {
                        numberOfCorrectAnswers ++;
                        
                        item._isCorrect = true;

                        this.model.set('_isAtLeastOneCorrectSelection', true);
                    }

                } else if (!item._shouldBeSelected && itemSelected) {
                    numberOfIncorrectAnswers ++;
                }

            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);
            this.model.set('_numberOfRequiredAnswers', numberOfRequiredAnswers);

            // Check if correct answers matches correct items and there are no incorrect selections
            var answeredCorrectly = (numberOfCorrectAnswers === numberOfRequiredAnswers) && (numberOfIncorrectAnswers === 0);
            return answeredCorrectly;
        },

        // Sets the score based upon the questionWeight
        // Can be overwritten if the question needs to set the score in a different way
        setScore: function() {
            var questionWeight = this.model.get("_questionWeight");
            var answeredCorrectly = this.model.get('_isCorrect');
            var score = answeredCorrectly ? questionWeight : 0;
            this.model.set('_score', score);
        },

        setupFeedback: function() {

            if (this.model.get('_isCorrect')) {
                this.setupCorrectFeedback();
            } else if (this.isPartlyCorrect()) {
                this.setupPartlyCorrectFeedback();
            } else {
                // apply individual item feedback
                if((this.model.get('_selectable') === 1) && this.model.get('_selectedItems')[0].feedback) {
                    this.setupIndividualFeedback(this.model.get('_selectedItems')[0]);
                    return;
                } else {
                    this.setupIncorrectFeedback();
                }
            }
        },

        setupIndividualFeedback: function(selectedItem) {
             this.model.set({
                 feedbackTitle: this.model.get('title'),
                 feedbackMessage: selectedItem.feedback
             });
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            if (!this.model.get('_canShowMarking')) return;

            _.each(this.model.get('_items'), function(item, i) {
                var $item = this.$('.component-item').eq(i);
                $item.removeClass('correct incorrect').addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            this.model.set({_userAnswer: []});
        },

        // Used by the question view to reset the look and feel of the component.
        resetQuestion: function() {

            this.deselectAllItems();
            this.resetItems();
        },

        deselectAllItems: function() {
            this.$el.a11y_selected(false);
            _.each(this.model.get('_items'), function(item) {
                item._isSelected = false;
            }, this);
        },

        resetItems: function() {
            this.$('.component-item label').removeClass('selected');
            this.$('.component-item').removeClass('correct incorrect');
            this.$('input').prop('checked', false);
            this.model.set({
                _selectedItems: [],
                _isAtLeastOneCorrectSelection: false
            });
        },

        showCorrectAnswer: function() {
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, item._shouldBeSelected);
            }, this);
        },

        setOptionSelected:function(index, selected) {
            var $itemLabel = this.$('label').eq(index);
            var $itemInput = this.$('input').eq(index);
            if (selected) {
                $itemLabel.addClass('selected');
                $itemInput.prop('checked', true);
            } else {
                $itemLabel.removeClass('selected');
                $itemInput.prop('checked', false);
            }
        },

        hideCorrectAnswer: function() {
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, this.model.get('_userAnswer')[item._index]);
            }, this);
        },

        /**
        * used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
        * returns the user's answers as a string in the format "1,5,2"
        */
        getResponse:function() {
            var selected = _.where(this.model.get('_items'), {'_isSelected':true});
            var selectedIndexes = _.pluck(selected, '_index');
            // indexes are 0-based, we need them to be 1-based for cmi.interactions
            for (var i = 0, count = selectedIndexes.length; i < count; i++) {
                selectedIndexes[i]++;
            }
            return selectedIndexes.join(',');
        },

        /**
        * used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
        */
        getResponseType:function() {
            return "choice";
        }

    });

    Adapt.register("mcq", Mcq);

    return Mcq;
});

define('components/adapt-contrib-gmcq/js/adapt-contrib-gmcq',['require','components/adapt-contrib-mcq/js/adapt-contrib-mcq','coreJS/adapt'],function(require) {
    var Mcq = require('components/adapt-contrib-mcq/js/adapt-contrib-mcq');
    var Adapt = require('coreJS/adapt');

    var Gmcq = Mcq.extend({

        events: function() {

            var events = {
                'focus .gmcq-item input': 'onItemFocus',
                'blur .gmcq-item input': 'onItemBlur',
                'change .gmcq-item input': 'onItemSelected',
                'keyup .gmcq-item input':'onKeyPress'
            };

            if ($('html').hasClass('ie8')) {

                var ie8Events = {
                    'click label img': 'forceChangeEvent'
                };

                events = _.extend(events, ie8Events);
            }

            return events;

        },

        onItemSelected: function(event) {

            var selectedItemObject = this.model.get('_items')[$(event.currentTarget).parent('.gmcq-item').index()];

            if (this.model.get('_isEnabled') && !this.model.get('_isSubmitted')) {
                this.toggleItemSelected(selectedItemObject, event);
            }

        },

        setupQuestion: function() {
            // if only one answer is selectable, we should display radio buttons not checkboxes
            this.model.set("_isRadio", (this.model.get("_selectable") == 1) );

            this.model.set('_selectedItems', []);

            this.setupQuestionItemIndexes();

            this.setupRandomisation();

            this.restoreUserAnswers();

            this.listenTo(Adapt, {
                'device:changed': this.resizeImage,
                'device:resize': this.onDeviceResize
            });

        },

        onQuestionRendered: function() {

            this.resizeImage(Adapt.device.screenSize);
            this.setUpColumns();

            this.$('label').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));

        },
        
        onDeviceResize: function() {
            this.setUpColumns();
        },

        resizeImage: function(width) {

            var imageWidth = width === 'medium' ? 'small' : width;

            this.$('label').each(function(index) {
                var src = $(this).find('img').attr('data-' + imageWidth);
                $(this).find('img').attr('src', src);
            });

        },

        setUpColumns: function() {
            var columns = this.model.get('_columns');

            if (!columns) return;

            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('gmcq-column-layout');
                this.$('.gmcq-item').css('width', (100 / columns) + '%');
            } else {
                this.$el.removeClass('gmcq-column-layout');
                this.$('.gmcq-item').css('width', '');
            }
        },

        // hack for IE8
        forceChangeEvent: function(event) {

            $("#" + $(event.currentTarget).closest("label").attr("for")).change();

        }

    }, {
        template: 'gmcq'
    });

    Adapt.register("gmcq", Gmcq);

    return Gmcq;

});

define('components/adapt-contrib-graphic/js/adapt-contrib-graphic',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Graphic = ComponentView.extend({

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.resizeImage);

            // Checks to see if the graphic should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.resizeImage(Adapt.device.screenSize, true);
        },

        // Used to check if the graphic should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-widget').off('inview');
                    this.setCompletionStatus();
                }

            }
        },

        remove: function() {
          // Remove any 'inview' listener attached.
          this.$('.component-widget').off('inview');

          ComponentView.prototype.remove.apply(this, arguments);
        },

        resizeImage: function(width, setupInView) {
            var imageWidth = width === 'medium' ? 'small' : width;
            var imageSrc = (this.model.get('_graphic')) ? this.model.get('_graphic')[imageWidth] : '';
            this.$('.graphic-widget img').attr('src', imageSrc);

            this.$('.graphic-widget').imageready(_.bind(function() {
                this.setReadyStatus();

                if (setupInView) {
                    // Bind 'inview' once the image is ready.
                    this.$('.component-widget').on('inview', _.bind(this.inview, this));
                }
            }, this));
        }
    });

    Adapt.register('graphic', Graphic);

    return Graphic;

});

define('components/adapt-contrib-hotgraphic/js/adapt-contrib-hotgraphic',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var HotGraphic = ComponentView.extend({

        isPopupOpen: false,
        
        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(this.model, 'change:_isVisible', this.toggleVisibility);
            this.listenTo(Adapt, 'accessibility:toggle', this.onAccessibilityToggle);
            
            this.model.set('_globals', Adapt.course.get('_globals'));
            
            _.bindAll(this, 'onKeyUp');
            
            this.preRender();
            
            if (this.model.get('_canCycleThroughPagination') === undefined) {
                this.model.set('_canCycleThroughPagination', false);
            }
            if (Adapt.device.screenSize == 'large') {
                this.render();
            } else {
                this.reRender();
            }
        },

        events: function() {
            return {
                'click .hotgraphic-graphic-pin': 'onPinClicked',
                'click .hotgraphic-popup-done': 'closePopup',
                'click .hotgraphic-popup-nav .back': 'previousHotGraphic',
                'click .hotgraphic-popup-nav .next': 'nextHotGraphic'
            }
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);

            // Checks to see if the hotgraphic should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.renderState();
            this.$('.hotgraphic-widget').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));

            this.setupEventListeners();
        },

        // Used to check if the hotgraphic should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);

                _.each(this.model.get('_items'), function(item) {
                    item._isVisited = false;
                });
            }
        },

        reRender: function() {
            if (Adapt.device.screenSize != 'large') {
                this.replaceWithNarrative();
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        replaceWithNarrative: function() {
            if (!Adapt.componentStore.narrative) throw "Narrative not included in build";
            var Narrative = Adapt.componentStore.narrative;

            var model = this.prepareNarrativeModel();
            var newNarrative = new Narrative({ model: model });
            var $container = $(".component-container", $("." + this.model.get("_parentId")));

            newNarrative.reRender();
            newNarrative.setupNarrative();
            $container.append(newNarrative.$el);
            Adapt.trigger('device:resize');
            _.defer(_.bind(function () {
                this.remove();
            }, this));
        },

        prepareNarrativeModel: function() {
            var model = this.model;
            model.set('_component', 'narrative');
            model.set('_wasHotgraphic', true);
            model.set('originalBody', model.get('body'));
            model.set('originalInstruction', model.get('instruction'));
            if (model.get('mobileBody')) {
                model.set('body', model.get('mobileBody'));
            }
            if (model.get('mobileInstruction')) {
                model.set('instruction', model.get('mobileInstruction'));
            }

            return model;
        },

        applyNavigationClasses: function (index) {
            var $nav = this.$('.hotgraphic-popup-nav'),
                itemCount = this.$('.hotgraphic-item').length;

            $nav.removeClass('first').removeClass('last');
            this.$('.hotgraphic-popup-done').a11y_cntrl_enabled(true);
            if(index <= 0 && !this.model.get('_canCycleThroughPagination')) {
                this.$('.hotgraphic-popup-nav').addClass('first');
                this.$('.hotgraphic-popup-controls.back').a11y_cntrl_enabled(false);
                this.$('.hotgraphic-popup-controls.next').a11y_cntrl_enabled(true);
            } else if (index >= itemCount-1 && !this.model.get('_canCycleThroughPagination')) {
                this.$('.hotgraphic-popup-nav').addClass('last');
                this.$('.hotgraphic-popup-controls.back').a11y_cntrl_enabled(true);
                this.$('.hotgraphic-popup-controls.next').a11y_cntrl_enabled(false);
            } else {
                this.$('.hotgraphic-popup-controls.back').a11y_cntrl_enabled(true);
                this.$('.hotgraphic-popup-controls.next').a11y_cntrl_enabled(true);
            }
            var classes = this.model.get("_items")[index]._classes 
                ? this.model.get("_items")[index]._classes
                : '';  // _classes has not been defined
      
            this.$('.hotgraphic-popup').attr('class', 'hotgraphic-popup ' + 'item-' + index + ' ' + classes);

        },

        onPinClicked: function (event) {
            if(event) event.preventDefault();
            
            this.$('.hotgraphic-popup-inner').a11y_on(false);
            this.$('.hotgraphic-item').hide().removeClass('active');
            
            var $currentHotSpot = this.$('.' + $(event.currentTarget).data('id'));
            $currentHotSpot.show().addClass('active');
            
            var currentIndex = this.$('.hotgraphic-item.active').index();
            this.setVisited(currentIndex);
            
            this.openPopup();
           
            this.applyNavigationClasses(currentIndex);
        },
        
        openPopup: function() {
            var currentIndex = this.$('.hotgraphic-item.active').index();
            this.$('.hotgraphic-popup-count .current').html(currentIndex + 1);
            this.$('.hotgraphic-popup-count .total').html(this.$('.hotgraphic-item').length);
            this.$('.hotgraphic-popup').attr('class', 'hotgraphic-popup item-' + currentIndex).show();
            this.$('.hotgraphic-popup-inner .active').a11y_on(true);
            
            this.isPopupOpen = true;
              
            Adapt.trigger('popup:opened',  this.$('.hotgraphic-popup-inner'));

            this.$('.hotgraphic-popup-inner .active').a11y_focus();
            
            this.setupEscapeKey();
        },

        closePopup: function(event) {
            if(event) event.preventDefault();
            
            this.$('.hotgraphic-popup').hide();
            
            this.isPopupOpen = false;
            
            Adapt.trigger('popup:closed',  this.$('.hotgraphic-popup-inner'));
        },

        previousHotGraphic: function (event) {
            event.preventDefault();
            var currentIndex = this.$('.hotgraphic-item.active').index();

            if (currentIndex === 0 && !this.model.get('_canCycleThroughPagination')) {
                return;
            } else if (currentIndex === 0 && this.model.get('_canCycleThroughPagination')) {
                currentIndex = this.model.get('_items').length;
            }

            this.$('.hotgraphic-item.active').hide().removeClass('active');
            this.$('.hotgraphic-item').eq(currentIndex-1).show().addClass('active');
            this.setVisited(currentIndex-1);
            this.$('.hotgraphic-popup-count .current').html(currentIndex);
            this.$('.hotgraphic-popup-inner').a11y_on(false);

            this.applyNavigationClasses(currentIndex-1);
            this.$('.hotgraphic-popup-inner .active').a11y_on(true);
            this.$('.hotgraphic-popup-inner .active').a11y_focus();
        },

        nextHotGraphic: function (event) {
            event.preventDefault();
            var currentIndex = this.$('.hotgraphic-item.active').index();
            if (currentIndex === (this.model.get('_items').length-1) && !this.model.get('_canCycleThroughPagination')) {
                return;
            } else if (currentIndex === (this.model.get('_items').length-1) && this.model.get('_canCycleThroughPagination')) {
                currentIndex = -1;
            }
            this.$('.hotgraphic-item.active').hide().removeClass('active');
            this.$('.hotgraphic-item').eq(currentIndex+1).show().addClass('active');
            this.setVisited(currentIndex+1);
            this.$('.hotgraphic-popup-count .current').html(currentIndex+2);
            this.$('.hotgraphic-popup-inner').a11y_on(false);

            this.applyNavigationClasses(currentIndex+1);
            this.$('.hotgraphic-popup-inner .active').a11y_on(true);
            this.$('.hotgraphic-popup-inner .active').a11y_focus();
        },

        setVisited: function(index) {
            var item = this.model.get('_items')[index];
            item._isVisited = true;

            var $pin = this.$('.hotgraphic-graphic-pin').eq(index);
            $pin.addClass('visited');
            // append the word 'visited.' to the pin's aria-label
            var visitedLabel = this.model.get('_globals')._accessibility._ariaLabels.visited + ".";
            $pin.attr('aria-label', function(index, val) {return val + " " + visitedLabel});

            $.a11y_alert("visited");

            this.checkCompletionStatus();
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        checkCompletionStatus: function() {
            if (this.getVisitedItems().length == this.model.get('_items').length) {
                this.trigger('allItems');
            }
        },

        onCompletion: function() {
            this.setCompletionStatus();
            if (this.completionEvent && this.completionEvent != 'inview') {
                this.off(this.completionEvent, this);
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'allItems' : this.model.get('_setCompletionOn');
            if (this.completionEvent !== 'inview') {
                this.on(this.completionEvent, _.bind(this.onCompletion, this));
            } else {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }
        },
        
        setupEscapeKey: function() {
            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive;

            if (!hasAccessibility && this.isPopupOpen) {
                $(window).on("keyup", this.onKeyUp);
            } else {
                $(window).off("keyup", this.onKeyUp);
            }
        },

        onAccessibilityToggle: function() {
            this.setupEscapeKey();
        },

        onKeyUp: function(event) {
            if (event.which != 27) return;
            
            event.preventDefault();

            this.closePopup();
        }

    });

    Adapt.register('hotgraphic', HotGraphic);

    return HotGraphic;

});
define('components/adapt-contrib-matching/js/adapt-contrib-matching',[
    'core/js/adapt',
    'core/js/views/questionView',
    'libraries/select2'
],function(Adapt, QuestionView) {

    var Matching = QuestionView.extend({

        // Used by questionView to disable the question during submit and complete stages
        disableQuestion: function() {
            this.$('select').prop("disabled", true).select2();
        },

        setupSelect2: function() {
            this.enableQuestion();
            if (this.model.get('_isEnabled') !== true) {
                // select2 ignores disabled property applied to <select> in the template 
                this.disableQuestion();
            }
        },

        // Used by questionView to enable the question during interactions
        enableQuestion: function() {
            this.$('select').prop("disabled", false).select2({
                minimumResultsForSearch: Infinity,
                dir: Adapt.config.get('_defaultDirection')
            });
        },

        // Used by questionView to reset the question when revisiting the component
        resetQuestionOnRevisit: function() {
            this.resetQuestion();
        },

        setupQuestion: function() {
            this.listenToOnce(Adapt, 'preRemove', this.onPreRemove);

            this.setupItemIndexes();
            
            this.restoreUserAnswers();

            this.setupRandomisation();
        },

        onPreRemove: function() {
            this.$('select').select2('destroy');
        },

        setupItemIndexes: function() {

            _.each(this.model.get("_items"), function(item, index) {
                if (item._index === undefined) {
                    item._index = index;
                    item._selected = false;
                }
                _.each(item._options, function(option, index) {
                    if (option._index === undefined) {
                        option._index = index;
                        option._isSelected = false;
                    }
                });
            });

        },

        restoreUserAnswers: function() {
            if (!this.model.get("_isSubmitted")) return;

            var userAnswer = this.model.get("_userAnswer");

            _.each(this.model.get("_items"), function(item, index) {
                _.each(item._options, function(option, index) {
                    if (option._index == userAnswer[item._index]) {
                        option._isSelected = true;
                        item._selected = option;
                    }
                });
            });

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
        },

        setupRandomisation: function() {
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                _.each(this.model.get('_items'), function(item) {
                    item._options = _.shuffle(item._options);
                });
            }
        },

        onQuestionRendered: function() {
            this.setReadyStatus();
            this.setupSelect2();
        },

        canSubmit: function() {

            var canSubmit = true;

            $('.matching-select option:selected', this.el).each(_.bind(function(index, element) {

                var $element = $(element);

                if ($element.index() === 0) {
                    canSubmit = false;
                    $element.parent('.matching-select').addClass('error');
                }
            }, this));

            return canSubmit;
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {
            //TODO have this highlight all the drop-downs the user has yet to select.
            //Currently it just highlights the first one, even if that one has been selected
        },

        storeUserAnswer: function() {

            var userAnswer = new Array(this.model.get('_items').length);
            var tempUserAnswer = new Array(this.model.get('_items').length);

            _.each(this.model.get('_items'), function(item, index) {

                var $selectedOption = this.$('.matching-select option:selected').eq(index);
                var optionIndex = $selectedOption.index() - 1;

                item._options[optionIndex]._isSelected = true;
                item._selected = item._options[optionIndex];

                tempUserAnswer[item._index] = optionIndex;
                userAnswer[item._index] = item._options[optionIndex]._index;
            }, this);

            this.model.set('_userAnswer', userAnswer);
            this.model.set('_tempUserAnswer', tempUserAnswer);
        },

        isCorrect: function() {

            var numberOfCorrectAnswers = 0;

            _.each(this.model.get('_items'), function(item, index) {

                if (item._selected && item._selected._isCorrect) {
                    numberOfCorrectAnswers++;
                    item._isCorrect = true;
                    this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);
                    this.model.set('_isAtLeastOneCorrectSelection', true);
                } else {
                    item._isCorrect = false;
                }

            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);

            if (numberOfCorrectAnswers === this.model.get('_items').length) {
                return true;
            } else {
                return false;
            }

        },

        setScore: function() {
            var questionWeight = this.model.get("_questionWeight");

            if (this.model.get('_isCorrect')) {
                this.model.set('_score', questionWeight);
                return;
            }

            var numberOfCorrectAnswers = this.model.get('_numberOfCorrectAnswers');
            var itemLength = this.model.get('_items').length;

            var score = questionWeight * numberOfCorrectAnswers / itemLength;

            this.model.set('_score', score);
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            if (!this.model.get('_canShowMarking')) return;

            _.each(this.model.get('_items'), function(item, i) {

                var $item = this.$('.matching-item').eq(i);
                $item.removeClass('correct incorrect').addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },

        // Used by the question to determine if the question is incorrect or partly correct
        // Should return a boolean
        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            this.model.set({_userAnswer: []});
        },

        // Used by the question view to reset the look and feel of the component.
        resetQuestion: function() {
            this.$('.matching-select option').prop('selected', false);
            
            this.$(".matching-item").removeClass("correct").removeClass("incorrect");
            
            this.model.set('_isAtLeastOneCorrectSelection', false);
            
            var placeholder = this.model.get('placeholder');
            
            _.each(this.model.get("_items"), function(item, index) {
                this.selectValue(index, placeholder);
                _.each(item._options, function(option, index) {
                    option._isSelected = false;
                });
            }, this);
        },

        showCorrectAnswer: function() {
            var items = this.model.get('_items');

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var correctOption = _.findWhere(item._options, {_isCorrect: true});
                this.selectValue(i, correctOption.text);
            }
        },

        hideCorrectAnswer: function() {
            var items = this.model.get('_items');
            for (var i = 0, count = items.length; i < count; i++) {
                var index = this.model.has('_tempUserAnswer')
                  ? this.model.get('_tempUserAnswer')[i]
                  : this.model.get('_userAnswer')[i];

                var item = items[i];
                var value = item._options[index].text;

                this.selectValue(i, value);
            }
        },

        selectValue: function(i, value) {
            this.$('select').eq(i).val(value).trigger('change');
        },

        /**
        * Used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
        * Returns the user's answers as a string in the format "1.1#2.3#3.2" assuming user selected option 1 in drop-down 1, option 3 in drop-down 2
        * and option 2 in drop-down 3. The '#' character will be changed to either ',' or '[,]' by adapt-contrib-spoor, depending on which SCORM version is being used.
        */
        getResponse: function() {

            var userAnswer = this.model.get('_userAnswer');
            var responses = [];

            for(var i = 0, count = userAnswer.length; i < count; i++) {
                responses.push((i + 1) + "." + (userAnswer[i] + 1));// convert from 0-based to 1-based counting
            }
            
            return responses.join('#');
        },

        /**
        * Used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
        */
        getResponseType: function() {
            return "matching";
        }

    });

    Adapt.register("matching", Matching);

    return Matching;

});

define('components/adapt-contrib-media/js/adapt-contrib-media',[
    'core/js/adapt',
    'core/js/views/componentView',
    'libraries/mediaelement-and-player',
    'libraries/mediaelement-and-player-accessible-captions'
], function(Adapt, ComponentView) {

    var froogaloopAdded = false;
    
    // The following function is used to to prevent a memory leak in Internet Explorer 
    // See: http://javascript.crockford.com/memory/leak.html
    function purge(d) {
        var a = d.attributes, i, l, n;
        if (a) {
            for (i = a.length - 1; i >= 0; i -= 1) {
                n = a[i].name;
                if (typeof d[n] === 'function') {
                    d[n] = null;
                }
            }
        }
        a = d.childNodes;
        if (a) {
            l = a.length;
            for (i = 0; i < l; i += 1) {
                purge(d.childNodes[i]);
            }
        }
    }

    var Media = ComponentView.extend({

        events: {
            "click .media-inline-transcript-button": "onToggleInlineTranscript"
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:resize', this.onScreenSizeChanged);
            this.listenTo(Adapt, 'device:changed', this.onDeviceChanged);
            this.listenTo(Adapt, 'accessibility:toggle', this.onAccessibilityToggle);

            _.bindAll(this, 'onMediaElementPlay', 'onMediaElementPause', 'onMediaElementEnded');

            // set initial player state attributes
            this.model.set({
                '_isMediaEnded': false,
                '_isMediaPlaying': false
            });

            if (this.model.get('_media').source) {
                // Remove the protocol for streaming service.
                // This prevents conflicts with HTTP/HTTPS
                var media = this.model.get('_media');

                media.source = media.source.replace(/^https?\:/, "");

                this.model.set('_media', media); 
            }

            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setupPlayer();
        },

        setupPlayer: function() {
            if (!this.model.get('_playerOptions')) this.model.set('_playerOptions', {});

            var modelOptions = this.model.get('_playerOptions');

            if (modelOptions.pluginPath === undefined) modelOptions.pluginPath = 'assets/';
            if(modelOptions.features === undefined) {
                modelOptions.features = ['playpause','progress','current','duration'];
                if (this.model.get('_useClosedCaptions')) {
                    modelOptions.features.unshift('tracks');
                }
                if (this.model.get("_allowFullScreen") && !$("html").is(".ie9")) {
                    modelOptions.features.push('fullscreen');
                }
            }

            modelOptions.success = _.bind(this.onPlayerReady, this);

            if (this.model.get('_useClosedCaptions')) {
                modelOptions.startLanguage = this.model.get('_startLanguage') === undefined ? 'en' : this.model.get('_startLanguage');
            }

            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                ? true
                : false;

            if (hasAccessibility) {
                modelOptions.alwaysShowControls = true;
                modelOptions.hideVideoControlsOnLoad = false;
            }

            if (modelOptions.alwaysShowControls === undefined) {
                modelOptions.alwaysShowControls = false;
            }
            if (modelOptions.hideVideoControlsOnLoad === undefined) {
                modelOptions.hideVideoControlsOnLoad = true;
            }

            this.addMediaTypeClass();

            this.addThirdPartyFixes(modelOptions, _.bind(function createPlayer() {
                // create the player
                this.$('audio, video').mediaelementplayer(modelOptions);

                // We're streaming - set ready now, as success won't be called above
                try {
                    if (this.model.get('_media').source) {
                        this.$('.media-widget').addClass('external-source');
                    }
                } catch (e) {
                    console.log("ERROR! No _media property found in components.json for component " + this.model.get('_id'));
                } finally {
                    this.setReadyStatus();
                }
            }, this));
        },

        addMediaTypeClass: function() {
            var media = this.model.get("_media");
            if (media && media.type) {
                var typeClass = media.type.replace(/\//, "-");
                this.$(".media-widget").addClass(typeClass);
            }
        },

        addThirdPartyFixes: function(modelOptions, callback) {
            var media = this.model.get("_media");
            if (!media) return callback();

            switch (media.type) {
                case "video/vimeo":
                    modelOptions.alwaysShowControls = false;
                    modelOptions.hideVideoControlsOnLoad = true;
                    modelOptions.features = [];
                    if (froogaloopAdded) return callback();
                    Modernizr.load({
                        load: "assets/froogaloop.js",
                        complete: function() {
                            froogaloopAdded = true;
                            callback();
                        }
                    });
                    break;
                default:
                    callback();
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'play' : this.model.get('_setCompletionOn');

            if (this.completionEvent === 'inview') {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }

            // handle other completion events in the event Listeners 
            $(this.mediaElement).on({
            	'play': this.onMediaElementPlay,
            	'pause': this.onMediaElementPause,
            	'ended': this.onMediaElementEnded
            });
        },

        onMediaElementPlay: function(event) {
            this.model.set({
                '_isMediaPlaying': true,
                '_isMediaEnded': false
            });
            
            if (this.completionEvent === 'play') {
                this.setCompletionStatus();
            }
        },

        onMediaElementPause: function(event) {
            this.model.set('_isMediaPlaying', false);
        },

        onMediaElementEnded: function(event) {
            this.model.set('_isMediaEnded', true);

            if (this.completionEvent === 'ended') {
                this.setCompletionStatus();
            }
        },

        // Overrides the default play/pause functionality to stop accidental playing on touch devices
        setupPlayPauseToggle: function() {
            // bit sneaky, but we don't have a this.mediaElement.player ref on iOS devices
            var player = this.mediaElement.player;

            if (!player) {
                console.log("Media.setupPlayPauseToggle: OOPS! there's no player reference.");
                return;
            }

            // stop the player dealing with this, we'll do it ourselves
            player.options.clickToPlayPause = false;

            this.onOverlayClick = _.bind(this.onOverlayClick, this);
            this.onMediaElementClick = _.bind(this.onMediaElementClick, this);

            // play on 'big button' click
            this.$('.mejs-overlay-button').on("click", this.onOverlayClick);

            // pause on player click
            this.$('.mejs-mediaelement').on("click", this.onMediaElementClick);
        },

        onOverlayClick: function() {
            var player = this.mediaElement.player;
            if (!player) return;

            player.play();
        },

        onMediaElementClick: function(event) {
            var player = this.mediaElement.player;
            if (!player) return;

            var isPaused = player.media.paused;
            if(!isPaused) player.pause();
        },

        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        remove: function() {
            this.$('.mejs-overlay-button').off("click", this.onOverlayClick);
            this.$('.mejs-mediaelement').off("click", this.onMediaElementClick);

            var modelOptions = this.model.get('_playerOptions');
            delete modelOptions.success;

            var media = this.model.get("_media");
            if (media) {
                switch (media.type) {
                case "video/vimeo":
                    this.$("iframe")[0].isRemoved = true;
                }
            }

            if ($("html").is(".ie8")) {
                var obj = this.$("object")[0];
                if (obj) {
                    obj.style.display = "none";
                }
            }
            if (this.mediaElement && this.mediaElement.player) {
                var player_id = this.mediaElement.player.id;

                purge(this.$el[0]);
                this.mediaElement.player.remove();

                if (mejs.players[player_id]) {
                    delete mejs.players[player_id];
                }
            }

            if (this.mediaElement) {
                $(this.mediaElement).off({
                	'play': this.onMediaElementPlay,
                	'pause': this.onMediaElementPause,
                	'ended': this.onMediaElementEnded
                });

                this.mediaElement.src = "";
                $(this.mediaElement.pluginElement).remove();
                delete this.mediaElement;
            }

            ComponentView.prototype.remove.call(this);
        },

        onDeviceChanged: function() {
            if (this.model.get('_media').source) {
                this.$('.mejs-container').width(this.$('.component-widget').width());
            }
        },

        onPlayerReady: function (mediaElement, domObject) {
            this.mediaElement = mediaElement;

            if (!this.mediaElement.player) {
                this.mediaElement.player =  mejs.players[this.$('.mejs-container').attr('id')];
            }

            var hasTouch = mejs.MediaFeatures.hasTouch;
            if (hasTouch) {
                this.setupPlayPauseToggle();
            }

            this.addThirdPartyAfterFixes();

            this.setReadyStatus();
            this.setupEventListeners();
        },

        addThirdPartyAfterFixes: function() {
            var media = this.model.get("_media");
            switch (media.type) {
            case "video/vimeo":
                this.$(".mejs-container").attr("tabindex", 0);
            }
        },

        onScreenSizeChanged: function() {
            this.$('audio, video').width(this.$('.component-widget').width());
        },

        onAccessibilityToggle: function() {
           this.showControls();
        },

        onToggleInlineTranscript: function(event) {
            if (event) event.preventDefault();
            var $transcriptBodyContainer = this.$(".media-inline-transcript-body-container");
            var $button = this.$(".media-inline-transcript-button");

            if ($transcriptBodyContainer.hasClass("inline-transcript-open")) {
                $transcriptBodyContainer.slideUp(function() {
                    $(window).resize();
                });
                $transcriptBodyContainer.removeClass("inline-transcript-open");
                $button.html(this.model.get("_transcript").inlineTranscriptButton);
            } else {
                $transcriptBodyContainer.slideDown(function() {
                    $(window).resize();
                }).a11y_focus();
                $transcriptBodyContainer.addClass("inline-transcript-open");
                $button.html(this.model.get("_transcript").inlineTranscriptCloseButton);
                if (this.model.get('_transcript')._setCompletionOnView !== false) {
                    this.setCompletionStatus();
                }
            }
        },

        showControls: function() {
            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                ? true
                : false;

            if (hasAccessibility) {
                if (!this.mediaElement.player) return;

                var player = this.mediaElement.player;

                player.options.alwaysShowControls = true;
                player.options.hideVideoControlsOnLoad = false;
                player.enableControls();
                player.showControls();

                this.$('.mejs-playpause-button button').attr({
                    "role": "button"
                });
                var screenReaderVideoTagFix = $("<div role='region' aria-label='.'>");
                this.$('.mejs-playpause-button').prepend(screenReaderVideoTagFix);

                this.$('.mejs-time, .mejs-time-rail').attr({
                    "aria-hidden": "true"
                });
            }
        }
    });

    Adapt.register('media', Media);

    return Media;

});

define('components/adapt-contrib-narrative/js/adapt-contrib-narrative',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Narrative = ComponentView.extend({

        events: {
            'click .narrative-strapline-title': 'openPopup',
            'click .narrative-controls': 'onNavigationClicked',
            'click .narrative-indicators .narrative-progress': 'onProgressClicked'
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);
            this.listenTo(Adapt, 'device:resize', this.resizeControl, this);
            this.listenTo(Adapt, 'notify:closed', this.closeNotify, this);
            this.setDeviceSize();

            // Checks to see if the narrative should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        postRender: function() {
            this.renderState();
            this.$('.narrative-slider').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));
            this.setupNarrative();
        },

        // Used to check if the narrative should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
                this.model.set({_stage: 0});

                _.each(this.model.get('_items'), function(item) {
                    item._isVisited = false;
                });
            }
        },

        setupNarrative: function() {
            this.setDeviceSize();
            if(!this.model.has('_items') || !this.model.get('_items').length) return;
            this.model.set('_marginDir', 'left');
            if (Adapt.config.get('_defaultDirection') == 'rtl') {
                this.model.set('_marginDir', 'right');
            }
            this.model.set('_itemCount', this.model.get('_items').length);

            this.model.set('_active', true);

            if (this.model.get('_stage')) {
                this.setStage(this.model.get('_stage'), true);
            } else {
                this.setStage(0, true);
            }
            this.calculateWidths();

            if (Adapt.device.screenSize !== 'large' && !this.model.get('_wasHotgraphic')) {
                this.replaceInstructions();
            }
            this.setupEventListeners();
            
            // if hasNavigationInTextArea set margin left 
            var hasNavigationInTextArea = this.model.get('_hasNavigationInTextArea');
            if (hasNavigationInTextArea == true) {
                var indicatorWidth = this.$('.narrative-indicators').width();
                var marginLeft = indicatorWidth / 2;
                
                this.$('.narrative-indicators').css({
                    marginLeft: '-' + marginLeft + 'px'
                });
            }
        },

        calculateWidths: function() {
            var slideWidth = this.$('.narrative-slide-container').width();
            var slideCount = this.model.get('_itemCount');
            var marginRight = this.$('.narrative-slider-graphic').css('margin-right');
            var extraMargin = marginRight === '' ? 0 : parseInt(marginRight);
            var fullSlideWidth = (slideWidth + extraMargin) * slideCount;

            this.$('.narrative-slider-graphic').width(slideWidth);
            this.$('.narrative-strapline-header').width(slideWidth);
            this.$('.narrative-strapline-title').width(slideWidth);

            this.$('.narrative-slider').width(fullSlideWidth);
            this.$('.narrative-strapline-header-inner').width(fullSlideWidth);

            var stage = this.model.get('_stage');
            var margin = -(stage * slideWidth);

            this.$('.narrative-slider').css(('margin-' + this.model.get('_marginDir')), margin);
            this.$('.narrative-strapline-header-inner').css(('margin-' + this.model.get('_marginDir')), margin);

            this.model.set('_finalItemLeft', fullSlideWidth - slideWidth);
        },

        resizeControl: function() {
            var wasDesktop = this.model.get('_isDesktop');
            this.setDeviceSize();
            if (wasDesktop != this.model.get('_isDesktop')) this.replaceInstructions();
            this.calculateWidths();
            this.evaluateNavigation();
        },

        reRender: function() {
            if (this.model.get('_wasHotgraphic') && Adapt.device.screenSize == 'large') {
                this.replaceWithHotgraphic();
            } else {
                this.resizeControl();
            }
        },

        closeNotify: function() {
            this.evaluateCompletion()
        },

        replaceInstructions: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$('.narrative-instruction-inner').html(this.model.get('instruction')).a11y_text();
            } else if (this.model.get('mobileInstruction') && !this.model.get('_wasHotgraphic')) {
                this.$('.narrative-instruction-inner').html(this.model.get('mobileInstruction')).a11y_text();
            }
        },

        replaceWithHotgraphic: function() {
            if (!Adapt.componentStore.hotgraphic) throw "Hotgraphic not included in build";
            var Hotgraphic = Adapt.componentStore.hotgraphic;
            
            var model = this.prepareHotgraphicModel();
            var newHotgraphic = new Hotgraphic({ model: model });
            var $container = $(".component-container", $("." + this.model.get("_parentId")));

            $container.append(newHotgraphic.$el);
            this.remove();
            $.a11y_update();
            _.defer(function() {
                Adapt.trigger('device:resize');
            });
        },

        prepareHotgraphicModel: function() {
            var model = this.model;
            model.set('_component', 'hotgraphic');
            model.set('body', model.get('originalBody'));
            model.set('instruction', model.get('originalInstruction'));
            return model;
        },

        moveSliderToIndex: function(itemIndex, animate, callback) {
            var extraMargin = parseInt(this.$('.narrative-slider-graphic').css('margin-right'));
            var movementSize = this.$('.narrative-slide-container').width() + extraMargin;
            var marginDir = {};
            if (animate && !Adapt.config.get('_disableAnimation')) {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.narrative-slider').velocity("stop", true).velocity(marginDir);
                this.$('.narrative-strapline-header-inner').velocity("stop", true).velocity(marginDir, {complete:callback});
            } else {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.narrative-slider').css(marginDir);
                this.$('.narrative-strapline-header-inner').css(marginDir);
                callback();
            }
        },

        setStage: function(stage, initial) {
            this.model.set('_stage', stage);
            if (this.model.get('_isDesktop')) {
                // Set the visited attribute for large screen devices
                var currentItem = this.getCurrentItem(stage);
                currentItem._isVisited = true;
            }

            this.$('.narrative-progress:visible').removeClass('selected').eq(stage).addClass('selected');
            this.$('.narrative-slider-graphic').children('.controls').a11y_cntrl_enabled(false);
            this.$('.narrative-slider-graphic').eq(stage).children('.controls').a11y_cntrl_enabled(true);
            this.$('.narrative-content-item').addClass('narrative-hidden').a11y_on(false).eq(stage).removeClass('narrative-hidden').a11y_on(true);
            this.$('.narrative-strapline-title').a11y_cntrl_enabled(false).eq(stage).a11y_cntrl_enabled(true);

            this.evaluateNavigation();
            this.evaluateCompletion();

            this.moveSliderToIndex(stage, !initial, _.bind(function() {
                if (this.model.get('_isDesktop')) {
                    if (!initial) this.$('.narrative-content-item').eq(stage).a11y_focus();
                } else {
                    if (!initial) this.$('.narrative-strapline-title').a11y_focus();
                }
            }, this));
        },

        constrainStage: function(stage) {
            if (stage > this.model.get('_items').length - 1) {
                stage = this.model.get('_items').length - 1;
            } else if (stage < 0) {
                stage = 0;
            }
            return stage;
        },

        constrainXPosition: function(previousLeft, newLeft, deltaX) {
            if (newLeft > 0 && deltaX > 0) {
                newLeft = previousLeft + (deltaX / (newLeft * 0.1));
            }
            var finalItemLeft = this.model.get('_finalItemLeft');
            if (newLeft < -finalItemLeft && deltaX < 0) {
                var distance = Math.abs(newLeft + finalItemLeft);
                newLeft = previousLeft + (deltaX / (distance * 0.1));
            }
            return newLeft;
        },

        evaluateNavigation: function() {
            var currentStage = this.model.get('_stage');
            var itemCount = this.model.get('_itemCount');
            if (currentStage == 0) {
                this.$('.narrative-controls').addClass('narrative-hidden');

                if (itemCount > 1) {
                    this.$('.narrative-control-right').removeClass('narrative-hidden');
                }
            } else {
                this.$('.narrative-control-left').removeClass('narrative-hidden');

                if (currentStage == itemCount - 1) {
                    this.$('.narrative-control-right').addClass('narrative-hidden');
                } else {
                    this.$('.narrative-control-right').removeClass('narrative-hidden');
                }
            }

        },

        getNearestItemIndex: function() {
            var currentPosition = parseInt(this.$('.narrative-slider').css('margin-left'));
            var graphicWidth = this.$('.narrative-slider-graphic').width();
            var absolutePosition = currentPosition / graphicWidth;
            var stage = this.model.get('_stage');
            var relativePosition = stage - Math.abs(absolutePosition);

            if (relativePosition < -0.3) {
                stage++;
            } else if (relativePosition > 0.3) {
                stage--;
            }

            return this.constrainStage(stage);
        },

        getCurrentItem: function(index) {
            return this.model.get('_items')[index];
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        evaluateCompletion: function() {
            if (this.getVisitedItems().length === this.model.get('_items').length) {
                this.trigger('allItems');
            } 
        },

        moveElement: function($element, deltaX) {
            var previousLeft = parseInt($element.css('margin-left'));
            var newLeft = previousLeft + deltaX;

            newLeft = this.constrainXPosition(previousLeft, newLeft, deltaX);
            $element.css(('margin-' + this.model.get('_marginDir')), newLeft + 'px');
        },

        openPopup: function(event) {
            event.preventDefault();
            var currentItem = this.getCurrentItem(this.model.get('_stage'));
            var popupObject = {
                title: currentItem.title,
                body: currentItem.body
            };

            // Set the visited attribute for small and medium screen devices
            currentItem._isVisited = true;

            Adapt.trigger('notify:popup', popupObject);
        },

        onNavigationClicked: function(event) {

            if (!this.model.get('_active')) return;

            var stage = this.model.get('_stage');
            var numberOfItems = this.model.get('_itemCount');

            if ($(event.currentTarget).hasClass('narrative-control-right')) {
                stage++;
            } else if ($(event.currentTarget).hasClass('narrative-control-left')) {
                stage--;
            }
            stage = (stage + numberOfItems) % numberOfItems;
            this.setStage(stage);
        },
        
        onProgressClicked: function(event) {
            event.preventDefault();
            var clickedIndex = $(event.target).index();
            this.setStage(clickedIndex);
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        onCompletion: function() {
            this.setCompletionStatus();
            if (this.completionEvent && this.completionEvent != 'inview') {
                this.off(this.completionEvent, this);
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'allItems' : this.model.get('_setCompletionOn');
            if (this.completionEvent !== 'inview' && this.model.get('_items').length > 1) {
                this.on(this.completionEvent, _.bind(this.onCompletion, this));
            } else {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }
        }

    });

    Adapt.register('narrative', Narrative);

    return Narrative;

});

define('components/adapt-contrib-text/js/adapt-contrib-text',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Text = ComponentView.extend({

        events: {
            'click .audio-controls .icon':'onAudioCtrlsClick'
        },

        preRender: function() {
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setReadyStatus();

            this.setupInview();
        },

        setupInview: function() {
            var selector = this.getInviewElementSelector();

            if (!selector) {
                this.setCompletionStatus();
            } else {
                this.model.set('inviewElementSelector', selector);
                this.$(selector).on('inview', _.bind(this.inview, this));
            }
        },

        /**
         * determines which element should be used for inview logic - body, instruction or title - and returns the selector for that element
         */
        getInviewElementSelector: function() {
            if(this.model.get('body')) return '.component-body';

            if(this.model.get('instruction')) return '.component-instruction';
            
            if(this.model.get('displayTitle')) return '.component-title';

            return null;
        },

        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$(this.model.get('inviewElementSelector')).off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        remove: function() {
            if(this.model.has('inviewElementSelector')) {
                this.$(this.model.get('inviewElementSelector')).off('inview');
            }
            
            ComponentView.prototype.remove.call(this);
        },

        onAudioCtrlsClick: function(event) {
            if (event) event.preventDefault();
            Adapt.trigger('audio', event.currentTarget);
        }
    },
    {
        template: 'text'
    });

    Adapt.register('text', Text);

    return Text;
});

define('components/adapt-contrib-textInput/js/adapt-contrib-textInput',['require','coreViews/questionView','coreJS/adapt'],function(require) {
    var QuestionView = require('coreViews/questionView');
    var Adapt = require('coreJS/adapt');

    var genericAnswerIndexOffset = 65536;

    var TextInput = QuestionView.extend({
        events: {
            "focus input":"clearValidationError"
        },

        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled(false);
            this.resetQuestion();
        },

        setupQuestion: function() {
            this.model.set( '_genericAnswerIndexOffset', genericAnswerIndexOffset );
            this.setupItemIndexes();
            this.restoreUserAnswer();

            this.setupRandomisation();
        },

        setupRandomisation: function() {
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                this.model.set("_items", _.shuffle(this.model.get("_items")));
            }
        },

        setupItemIndexes: function() {
            
            _.each(this.model.get('_items'), function(item, index) {

                if (item._index === undefined) item._index = index;
                if (item._answerIndex === undefined) item._answerIndex = -1;

            });

        },

        restoreUserAnswer: function() {
            if (!this.model.get("_isSubmitted")) return;

            var userAnswer = this.model.get("_userAnswer");
            var genericAnswers = this.model.get("_answers");
            _.each(this.model.get("_items"), function(item) {
                var answerIndex = userAnswer[item._index];
                if (answerIndex >= genericAnswerIndexOffset) {
                    item.userAnswer = genericAnswers[answerIndex - genericAnswerIndexOffset];
                    item._answerIndex = answerIndex;
                } else if (answerIndex > -1) {
                    item.userAnswer = item._answers[answerIndex];
                    item._answerIndex = answerIndex;
                } else {
                    if (item.userAnswer === undefined) item.userAnswer = "******";
                    item._answerIndex = -1;
                }
                if (item.userAnswer instanceof Array) item.userAnswer = item.userAnswer[0];
            });

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
        },  

        disableQuestion: function() {
            this.setAllItemsEnabled(false);
        },

        enableQuestion: function() {
            this.setAllItemsEnabled(true);
        },

        setAllItemsEnabled: function(isEnabled) {
            _.each(this.model.get('_items'), function(item, index) {
                var $itemInput = this.$('input').eq(index);

                if (isEnabled) {
                    $itemInput.prop('disabled', false);
                } else {
                    $itemInput.prop('disabled', true);
                }
            }, this);
        },

        onQuestionRendered: function() {
            this.setReadyStatus();
        },

        clearValidationError: function() {
            this.$(".textinput-item-textbox").removeClass("textinput-validation-error");
        },

        // Use to check if the user is allowed to submit the question
        canSubmit: function() {
            var canSubmit = true;
            this.$(".textinput-item-textbox").each(function() {
                if ($(this).val() == "") {
                    canSubmit = false;
                }
            });
            return canSubmit;
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {
            this.showValidationError();
        },

        showValidationError: function() {
            this.$(".textinput-item-textbox").addClass("textinput-validation-error");
        },

        //This preserve the state of the users answers for returning or showing the users answer
        storeUserAnswer: function() {
            var items = this.model.get('_items');
            _.each(items, function(item, index) {
                item.userAnswer = this.$('.textinput-item-textbox').eq(index).val();
            }, this);

            this.isCorrect();

            var userAnswer = new Array( items.length );
            _.each(items, function(item, index) {
                userAnswer[ item._index ] = item._answerIndex;
            });
            this.model.set("_userAnswer", userAnswer);
        },

        isCorrect: function() {
            if(this.model.get('_answers')) this.markGenericAnswers();
            else this.markSpecificAnswers();
            // do we have any _isCorrect == false?
            return !_.contains(_.pluck(this.model.get("_items"),"_isCorrect"), false);
        },

        // Allows the learner to give answers into any input, ignoring the order.
        // (this excludes any inputs which have their own specific answers).
        markGenericAnswers: function() {
            var numberOfCorrectAnswers = 0;
            var correctAnswers = this.model.get('_answers').slice();
            var usedAnswerIndexes = [];
            _.each(this.model.get('_items'), function(item, itemIndex) {
                _.each(correctAnswers, function(answerGroup, answerIndex) {
                    if(this.checkAnswerIsCorrect(answerGroup, item.userAnswer)) {
                        if (_.indexOf(usedAnswerIndexes, answerIndex) > -1) return;
                        usedAnswerIndexes.push(answerIndex);
                        item._isCorrect = true;
                        item._answerIndex = answerIndex + genericAnswerIndexOffset;
                        numberOfCorrectAnswers++;
                        this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);
                        this.model.set('_isAtLeastOneCorrectSelection', true);
                    }
                }, this);
                if(!item._isCorrect) item._isCorrect = false;
            }, this);
        },

        // Marks any items which have answers specific to it
        // (i.e. item has a _answers array)
        markSpecificAnswers: function() {
            var numberOfCorrectAnswers = 0;
            var numberOfSpecificAnswers = 0;
            _.each(this.model.get('_items'), function(item, index) {
                if(!item._answers) return;
                var userAnswer = item.userAnswer || ""; 
                if (this.checkAnswerIsCorrect(item["_answers"], userAnswer)) {
                    numberOfCorrectAnswers++;
                    item._isCorrect = true;
                    item._answerIndex = _.indexOf(item["_answers"], this.cleanupUserAnswer(userAnswer));
                    this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);
                    this.model.set('_isAtLeastOneCorrectSelection', true);
                } else {
                    item._isCorrect = false;
                    item._answerIndex = -1;
                }
                numberOfSpecificAnswers++;
            }, this);
        },

        checkAnswerIsCorrect: function(possibleAnswers, userAnswer) {
            var uAnswer = this.cleanupUserAnswer(userAnswer);
            var matched = _.filter(possibleAnswers, function(cAnswer){
                return this.cleanupUserAnswer(cAnswer) == uAnswer;
            }, this);
            
            var answerIsCorrect = matched && matched.length > 0;
            if (answerIsCorrect) this.model.set('_hasAtLeastOneCorrectSelection', true);
            return answerIsCorrect;
        },

        cleanupUserAnswer: function(userAnswer) {
            if (this.model.get('_allowsAnyCase')) {
                userAnswer = userAnswer.toLowerCase();
            }
            if (this.model.get('_allowsPunctuation')) {
                userAnswer = userAnswer.replace(/[\.,-\/#!$£%\^&\*;:{}=\-_`~()]/g, "");
                //remove any orphan double spaces and replace with single space (B & Q)->(B  Q)->(B Q)
                userAnswer = userAnswer.replace(/(  +)+/g, " ");
            }
            // removes whitespace from beginning/end (leave any in the middle)
            return $.trim(userAnswer);
        },

        // Used to set the score based upon the _questionWeight
        setScore: function() {
            var numberOfCorrectAnswers = this.model.get('_numberOfCorrectAnswers');
            var questionWeight = this.model.get("_questionWeight");
            var itemLength = this.model.get('_items').length;

            var score = questionWeight * numberOfCorrectAnswers / itemLength;

            this.model.set('_score', score);
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            if (!this.model.get('_canShowMarking')) return;

            _.each(this.model.get('_items'), function(item, i) {
                var $item = this.$('.textinput-item').eq(i);
                $item.removeClass('correct incorrect').addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            _.each(this.model.get('_items'), function(item) {
                item["_isCorrect"] = false;
                item["userAnswer"] = "";
            }, this);
        },

        // Used by the question view to reset the look and feel of the component.
        resetQuestion: function() {
            this.$('.textinput-item-textbox').prop('disabled', !this.model.get('_isEnabled')).val('');

            this.model.set({
                _isAtLeastOneCorrectSelection: false,
                _isCorrect: undefined
            });
        },

        showCorrectAnswer: function() {
            
            if(this.model.get('_answers'))  {
                
                var correctAnswers = this.model.get('_answers');
                _.each(this.model.get('_items'), function(item, index) {
                    this.$(".textinput-item-textbox").eq(index).val(correctAnswers[index][0]);
                }, this);
                
            } else {
                _.each(this.model.get('_items'), function(item, index) {
                    this.$(".textinput-item-textbox").eq(index).val(item._answers[0]);
                }, this);
            }
            
        },

        hideCorrectAnswer: function() {
            _.each(this.model.get('_items'), function(item, index) {
                this.$(".textinput-item-textbox").eq(index).val(item.userAnswer);
            }, this);
        },

        /**
        * used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
        * returns the user's answers as a string in the format "answer1[,]answer2[,]answer3"
        * the use of [,] as an answer delimiter is from the SCORM 2004 specification for the fill-in interaction type
        */
        getResponse: function() {
            return _.pluck(this.model.get('_items'), 'userAnswer').join('[,]');
        },

        /**
        * used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
        */
        getResponseType: function() {
            return "fill-in";
        }
    });

    Adapt.register("textinput", TextInput);

    return TextInput;
});

define('components/adapt-expose/js/adapt-expose',['require','coreViews/componentView','coreJS/adapt'],function(require) {

	function toHyphenCase(str) {
		if (!str) return false;
		return str.replace(/([A-Z])/g, "-$1").toLowerCase();
	}

	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');

	var Expose = ComponentView.extend({
		events: {
			"click .expose-item-cover": "toggleItem",
			"click .expose-item-content": "toggleItem",
			"click .expose-item-button": "toggleItem"
		},

		onDeviceResize: function() {
			this.setupColumns();
			this.setEqualHeights();
		},

		preRender: function() {
			this.animationType = toHyphenCase(this.model.get("_animationType")) || "fade";
		},

		postRender: function() {
			this.$(".expose-item").children().addClass(this.animationType);
			this.setupColumns();
			this.setEqualHeights();
			this.setReadyStatus();
			this.setupEventListeners();
		},

		setupColumns: function() {
			if (this.model.get("_columns") && $(window).width() > 760) {
				var w = 100 / this.model.get("_columns") + "%";
				this.$(".expose-items").addClass("expose-columns");
				this.$(".expose-item").width(w).addClass("expose-column");
			} else {
				this.$(".expose-items").removeClass("expose-columns");
				this.$(".expose-item").width("auto").removeClass("expose-column");
			}
		},

		setEqualHeights: function () {
			if (this.model.get("_equalHeights") === false) return;
			var $contentElements = this.$(".expose-item-content");
			var hMax = 0;
			_.each($contentElements, function(el) {
				var h = $(el).outerHeight();
				if (h > hMax) hMax = h;
			});
			$contentElements.height(hMax);
		},
		
		setupEventListeners: function() {
			this.listenTo(Adapt, {'device:resize': this.onDeviceResize});
		},

		toggleItem: function(e) {
			if (e.target.tagName === "A") return;
			var $parent = $(e.currentTarget).parent();
			var $cover = $parent.children(".expose-item-cover");
			$cover.toggleClass(this.animationType);
			if (!$cover.is(".visited")) {
				$cover.addClass("visited");
				var i = $cover.parents(".expose-item").index();
				this.model.get("_items")[i]._isVisited = true;
				this.evaluateCompletion();
			}
		},

		evaluateCompletion: function() {
			var incompleteItems = _.filter(this.model.get("_items"), function(item) {
				return !item._isVisited;
			});
			!incompleteItems.length && this.onComplete();
		},

		onComplete: function() {
			this.setCompletionStatus();

		}

	});

	Adapt.register('expose', Expose);

	return Expose;

});


define('components/adapt-hotgrid/js/adapt-hotgrid',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require("coreViews/componentView");
    var Adapt = require("coreJS/adapt");

    var Hotgrid = ComponentView.extend({
 
        events: {
            "click .hotgrid-item-image":"onItemClicked"
        },
        
        isPopupOpen: false,
        
        preRender: function () {
            var items = this.model.get('_items');
            _.each(items, function(item) {
                if (item._graphic.srcHover && item._graphic.srcVisited) {
                    item._graphic.hasImageStates = true;
                }
            }, this);
            
            this.listenTo(Adapt, 'device:changed', this.resizeControl);
            
            this.setDeviceSize();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        postRender: function() {
            this.setUpColumns();
            this.$('.hotgrid-widget').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));
        },

        resizeControl: function() {
            this.setDeviceSize();
            this.render();
        },

        setUpColumns: function() {
            var columns = this.model.get('_columns');

            if (columns && Adapt.device.screenSize === 'large') {
                this.$('.hotgrid-grid-item').css('width', (100 / columns) + '%');
            }
        },

        onItemClicked: function(event) {
            if (event) event.preventDefault();

            var $link = $(event.currentTarget);
            var $item = $link.parent();
            var itemModel = this.model.get('_items')[$item.index()];

            if(!itemModel.visited) {
                $item.addClass("visited");
                itemModel.visited = true;
                // append the word 'visited.' to the link's aria-label
                var visitedLabel = this.model.get('_globals')._accessibility._ariaLabels.visited + ".";
                $link.attr('aria-label', function(index,val) {return val + " " + visitedLabel});
            }

            this.showItemContent(itemModel);

        },

        showItemContent: function(itemModel) {
            if(this.isPopupOpen) return;// ensure multiple clicks don't open multiple notify popups

            Adapt.trigger("notify:popup", {
                title: itemModel.title,
                body: "<div class='hotgrid-notify-container'><div class='hotgrid-notify-body'>" + itemModel.body + "</div>" +
					"<img class='hotgrid-notify-graphic' src='" +
                    itemModel._itemGraphic.src + "' alt='" +
                    itemModel._itemGraphic.alt + "'/></div>"
            });

            this.isPopupOpen = true;

            Adapt.once("notify:closed", _.bind(function() {
                this.isPopupOpen = false;
                this.evaluateCompletion();
            }, this));
        },
        
        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item.visited;
            });
        },

        evaluateCompletion: function() {
            if (this.getVisitedItems().length == this.model.get('_items').length) {
                this.setCompletionStatus();
            }
        }
        
    },{
        template: "hotgrid"
    });
    
    Adapt.register("hotgrid", Hotgrid);
    
    return Hotgrid;

});

define('components/adapt-narrativeStrip/js/adapt-narrativeStrip',[ "coreJS/adapt", "coreViews/componentView" ], function(Adapt, ComponentView) {

    var Narrative = ComponentView.extend({

        events: {
            'click .ns-controls':'onNavigationClicked'
        },

        preRender: function () {
            this.listenTo(Adapt, 'device:resize', this.resizeControl, this);
            this.setDeviceSize();            
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        postRender: function() {
            this.setupImages();
            this.setupNarrative();
        },

        setupImages: function() {
            var _items = this.model.get("_items");
            var _images = this.model.get("_images");

            var splitHeight = _items.length;
            var images = _images.length;
            var imagesSplit = 0;

            var thisHandle = this;

            var height = undefined;
            var width = undefined;

            var imagesToLoadCount = 0;
            var imagesLoadedCount = 0;

            _.each(_images, function(image) {
                var imageObj = new Image();
                $(imageObj).bind("load", function(event) {
                    imagesSplit++;

                    var imgHeight = imageObj.naturalHeight;
                    var imgWidth = imageObj.naturalWidth;

                    height = height || imageObj.naturalHeight;
                    width = width || imageObj.naturalWidth;

                    var finalHeight = height / splitHeight;

                    var offsetTop = 0;
                    var offsetLeft = 0;
                    var newHeight = height;

                    if (imgWidth != width) newHeight = (width/imgWidth) * imgHeight;

                    var canvas = document.createElement("canvas");
                    if (typeof G_vmlCanvasManager != 'undefined') G_vmlCanvasManager.initElement(canvas);
                    canvas.width = width; 
                    canvas.style.width = "100%"; 
                    canvas.height = finalHeight; 

                    var ctx = canvas.getContext("2d");

                    for (var s = 0; s < splitHeight; s++) {
                        ctx.drawImage(imageObj, 0, 0, imgWidth, imgHeight, 0 + offsetLeft, -(s * finalHeight) + offsetTop, width, newHeight);
                        var imageURL = canvas.toDataURL();

                        var img = document.createElement("img");
                        thisHandle.$('.item-'+s+'.ns-slide-container .i'+image._id).append(img);
                        imagesToLoadCount++;
                        $(img).bind("load", function() {
                            imagesLoadedCount++;

                            if (imagesToLoadCount == imagesLoadedCount) {
                                thisHandle.setReadyStatus();
                                $(window).resize();
                            }
                        });
                        img.src = imageURL;

                    }

                    if (imagesSplit == images) {
                        thisHandle.calculateWidths();
                    }

                });
                imageObj.src = image.src;
            });
        },

        setupNarrative: function() {

        	this.completionEvent = this.model.get('_setCompletionOn') || false; 

            if(this.completionEvent === 'inview'){
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }

            this.setDeviceSize();
            
            var _items = this.model.get("_items");
            var thisHandle = this;
            _.each(_items, function(item, index) {
                item._itemCount = item._subItems.length;
                if (item._stage) {
                    thisHandle.setStage(index, item._stage, true);
                } else {
                    thisHandle.setStage(index, (item._initialItemIndex || 0) );
                }
            });
            
            this.model.set('_active', true);

        },

        calculateWidths: function() {
            //calc widths for each item
            var _items = this.model.get("_items");
            _.each(_items, function(item, index) {
                var slideWidth = this.$('.ns-slide-container').width();
                var slideCount = item._itemCount;
                var marginRight = this.$('.ns-slider-graphic').css('margin-right');

                var extraMargin = marginRight === "" ? 0 : parseInt(marginRight);
                var fullSlideWidth = (slideWidth + extraMargin) * slideCount;
                var iconWidth = this.$('.ns-popup-open').outerWidth();
                var $headerInner = this.$(".item-" + index)
                    .find(".ns-strapline-header-inner");

                this.$('.item-'+index+'.ns-slide-container .ns-slider-graphic').width(slideWidth)
                this.$('.ns-strapline-header').width(slideWidth);
                this.$('.ns-strapline-title').width(slideWidth);

                this.$('.item-'+index+'.ns-slide-container .ns-slider').width(fullSlideWidth);
                $headerInner.width(fullSlideWidth);

                var stage = item._stage;//this.model.get('_stage');
                var margin = -(stage * slideWidth);

                this.$('.item-'+index+'.ns-slide-container .ns-slider').css('margin-left', margin);
                $headerInner.css("margin-left", margin);

                item._finalItemLeft = fullSlideWidth - slideWidth;
            });

            _.each(this.$('.ns-slider-graphic'), function(item) {
                $(item).attr("height","").css("height","");
            });
        },

        resizeControl: function() {
            this.setDeviceSize();
            this.calculateWidths();
            var _items = this.model.get("_items");
            var thisHandle = this;
            _.each(_items, function(item, index) {
                thisHandle.evaluateNavigation(index);
            });
        },

        moveSliderToIndex: function(itemIndex, stage, animate) {
            var extraMargin = parseInt(this.$('.item-'+itemIndex+'.ns-slide-container .ns-slider-graphic').css('margin-right')),
                movementSize = this.$('.item-'+itemIndex+'.ns-slide-container').width()+extraMargin;

            if(animate) {
                this.$('.item-'+itemIndex+'.ns-slide-container .ns-slider').stop().animate({'margin-left': -(movementSize * stage)});
                this.$('.item-'+itemIndex+' .ns-strapline-header .ns-strapline-header-inner').stop(true, true).animate({'margin-left': -(movementSize * stage)});
            } else {
                this.$('.item-'+itemIndex+'.ns-slide-container .ns-slider').css({'margin-left': -(movementSize * stage)});
                this.$('.item-'+itemIndex+' .ns-strapline-header .ns-strapline-header-inner').css({'margin-left': -(movementSize * stage)});
            }
        },

        setStage: function(itemIndex, stage, initial) {
            var item = this.model.get('_items')[itemIndex];

            item._stage = stage;
            item._subItems[stage].isComplete = true;

            this.$('.ns-progress').removeClass('selected').eq(stage).addClass('selected');
            this.$('.item-'+itemIndex+'.ns-slide-container .ns-slider-graphic').children('.controls').attr('tabindex', -1);
            this.$('.item-'+itemIndex+'.ns-slide-container .ns-slider-graphic').eq(stage).children('.controls').attr('tabindex', 0);

            this.evaluateNavigation(itemIndex);
            this.evaluateCompletion();

            this.moveSliderToIndex(itemIndex, stage, !initial);
        },

        evaluateNavigation: function(itemIndex) {
            var item = this.model.get('_items')[itemIndex];
            var currentStage = item._stage;
            var itemCount = item._itemCount;

            if (currentStage == 0) {
                this.$('.item-'+itemIndex+'.ns-slide-container .ns-control-left').addClass('ns-hidden');

                if (itemCount > 1) {
                    this.$('.item-'+itemIndex+'.ns-slide-container .ns-control-right').removeClass('ns-hidden');
                }
            } else {
                this.$('.item-'+itemIndex+'.ns-slide-container .ns-control-left').removeClass('ns-hidden');

                if (currentStage == itemCount - 1) {
                    this.$('.item-'+itemIndex+'.ns-slide-container .ns-control-right').addClass('ns-hidden');
                } else {
                    this.$('.item-'+itemIndex+'.ns-slide-container .ns-control-right').removeClass('ns-hidden');
                }
            }
        },

        evaluateCompletion: function() {
            if(this.completionEvent === 'inview') return;

            var items = this.model.get('_items');
            var isComplete = true;

            for(var i=0,item=null;item=items[i];i++){

                for(var j=0,subItem=null;subItem=item._subItems[j];j++){
                    if(!subItem.isComplete){
                        isComplete = false;
                        break;
                    }
                }
                
                if(!isComplete) break;                
            }

            if(isComplete) this.setCompletionStatus();
        },

        onNavigationClicked: function(event) {
            event.preventDefault();

            var $target = $(event.currentTarget);

            if ($target.hasClass('disabled')) return;

            if (!this.model.get('_active')) return;

			var selectedItemIndex = $target.parent('.component-item').index();
            var selectedItemObject = this.model.get('_items')[selectedItemIndex];

            var stage = selectedItemObject._stage,
                numberOfItems = selectedItemObject._itemCount;

            if ($target.hasClass('ns-control-right')) {
                stage++;
                if (stage == numberOfItems-1) {
                    $('.ns-control-left').focus();
                }
            } else if ($target.hasClass('ns-control-left')) {
                stage--;
                if (stage == 0) {
                    $('.ns-control-right').focus();
                }
            }
            stage = (stage + numberOfItems) % numberOfItems;
            this.setStage(selectedItemIndex, stage);
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {                    
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        }

    });

    Adapt.register("narrativeStrip", Narrative);

    return Narrative;

});

define('components/adapt-native-media/js/adapt-native-media',['require','coreViews/componentView','coreJS/adapt'],function(require) {
    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var NativeMedia = ComponentView.extend({

        events: {
            "click .transcript-button": "toggleTranscript"
        },

        postRender: function() {
        	this.setCompletionOn();
        	this.setReadyStatus();
        },

        setCompletionOn: function() {
        	var $video = $(this.$("video")[0]);
        	var completionOn = this.model.get("_setCompletionOn");
        	switch(completionOn) {
			    case "play":
			        this.setCompletionOnPlay($video);
			        break;
			    case "ended":
			        this.setCompletionOnEnded($video);
			        break;
			    default:
			        this.setupCompletionOnInview();
			}
        },

        setupCompletionOnInview: function() {
        	this.$(".nativeMedia-widget").on("inview", _.bind(this.inview, this));
        },

        setCompletionOnPlay: function($video) {
        	$video.one("play", _.bind(function() {
        		this.setCompletionStatus();
        	}, this));
        },

        setCompletionOnEnded: function($video) {
        	$video.one("ended", _.bind(function() {
        		this.setCompletionStatus();
        	}, this));
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                	this.$(".nativeMedia-widget").off("inview");
                    this.setCompletionStatus();
                }
            }
        },

        toggleTranscript: function() {
            var slideDirection = "slideDown";
            if (this.transcriptOpen) {
                slideDirection = "slideUp"
                this.transcriptOpen = false;
            } else {
                this.transcriptOpen = true;
            }
            this.$(".transcript-body").velocity(slideDirection, {
                duration: 500
            });
        }

    });

    Adapt.register("nativeMedia", NativeMedia);

});
/*!
 * Draggabilly PACKAGED v1.1.1
 * Make that shiz draggable
 * http://draggabilly.desandro.com
 * MIT license
 */

/*!
 * classie - class helper functions
 * from bonzo https://github.com/ded/bonzo
 * 
 * classie.has( elem, 'my-class' ) -> true/false
 * classie.add( elem, 'my-new-class' )
 * classie.remove( elem, 'my-unwanted-class' )
 * classie.toggle( elem, 'my-class' )
 */

/*jshint browser: true, strict: true, undef: true */
/*global define: false */

( function( window ) {



// class helper functions from bonzo https://github.com/ded/bonzo

function classReg( className ) {
  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
}

// classList support for class management
// altho to be fair, the api sucks because it won't accept multiple classes at once
var hasClass, addClass, removeClass;

if ( 'classList' in document.documentElement ) {
  hasClass = function( elem, c ) {
    return elem.classList.contains( c );
  };
  addClass = function( elem, c ) {
    elem.classList.add( c );
  };
  removeClass = function( elem, c ) {
    elem.classList.remove( c );
  };
}
else {
  hasClass = function( elem, c ) {
    return classReg( c ).test( elem.className );
  };
  addClass = function( elem, c ) {
    if ( !hasClass( elem, c ) ) {
      elem.className = elem.className + ' ' + c;
    }
  };
  removeClass = function( elem, c ) {
    elem.className = elem.className.replace( classReg( c ), ' ' );
  };
}

function toggleClass( elem, c ) {
  var fn = hasClass( elem, c ) ? removeClass : addClass;
  fn( elem, c );
}

var classie = {
  // full names
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass,
  // short names
  has: hasClass,
  add: addClass,
  remove: removeClass,
  toggle: toggleClass
};

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'classie/classie',classie );
} else {
  // browser global
  window.classie = classie;
}

})( window );

/*!
 * EventEmitter v4.2.2 - git.io/ee
 * Oliver Caldwell
 * MIT license
 * @preserve
 */

(function () {
	

	/**
	 * Class for managing events.
	 * Can be extended to provide event functionality in other classes.
	 *
	 * @class EventEmitter Manages event registering and emitting.
	 */
	function EventEmitter() {}

	// Shortcuts to improve speed and size

	// Easy access to the prototype
	var proto = EventEmitter.prototype;

	/**
	 * Finds the index of the listener for the event in it's storage array.
	 *
	 * @param {Function[]} listeners Array of listeners to search through.
	 * @param {Function} listener Method to look for.
	 * @return {Number} Index of the specified listener, -1 if not found
	 * @api private
	 */
	function indexOfListener(listeners, listener) {
		var i = listeners.length;
		while (i--) {
			if (listeners[i].listener === listener) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Alias a method while keeping the context correct, to allow for overwriting of target method.
	 *
	 * @param {String} name The name of the target method.
	 * @return {Function} The aliased method
	 * @api private
	 */
	function alias(name) {
		return function aliasClosure() {
			return this[name].apply(this, arguments);
		};
	}

	/**
	 * Returns the listener array for the specified event.
	 * Will initialise the event object and listener arrays if required.
	 * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
	 * Each property in the object response is an array of listener functions.
	 *
	 * @param {String|RegExp} evt Name of the event to return the listeners from.
	 * @return {Function[]|Object} All listener functions for the event.
	 */
	proto.getListeners = function getListeners(evt) {
		var events = this._getEvents();
		var response;
		var key;

		// Return a concatenated array of all matching events if
		// the selector is a regular expression.
		if (typeof evt === 'object') {
			response = {};
			for (key in events) {
				if (events.hasOwnProperty(key) && evt.test(key)) {
					response[key] = events[key];
				}
			}
		}
		else {
			response = events[evt] || (events[evt] = []);
		}

		return response;
	};

	/**
	 * Takes a list of listener objects and flattens it into a list of listener functions.
	 *
	 * @param {Object[]} listeners Raw listener objects.
	 * @return {Function[]} Just the listener functions.
	 */
	proto.flattenListeners = function flattenListeners(listeners) {
		var flatListeners = [];
		var i;

		for (i = 0; i < listeners.length; i += 1) {
			flatListeners.push(listeners[i].listener);
		}

		return flatListeners;
	};

	/**
	 * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
	 *
	 * @param {String|RegExp} evt Name of the event to return the listeners from.
	 * @return {Object} All listener functions for an event in an object.
	 */
	proto.getListenersAsObject = function getListenersAsObject(evt) {
		var listeners = this.getListeners(evt);
		var response;

		if (listeners instanceof Array) {
			response = {};
			response[evt] = listeners;
		}

		return response || listeners;
	};

	/**
	 * Adds a listener function to the specified event.
	 * The listener will not be added if it is a duplicate.
	 * If the listener returns true then it will be removed after it is called.
	 * If you pass a regular expression as the event name then the listener will be added to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to attach the listener to.
	 * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addListener = function addListener(evt, listener) {
		var listeners = this.getListenersAsObject(evt);
		var listenerIsWrapped = typeof listener === 'object';
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
				listeners[key].push(listenerIsWrapped ? listener : {
					listener: listener,
					once: false
				});
			}
		}

		return this;
	};

	/**
	 * Alias of addListener
	 */
	proto.on = alias('addListener');

	/**
	 * Semi-alias of addListener. It will add a listener that will be
	 * automatically removed after it's first execution.
	 *
	 * @param {String|RegExp} evt Name of the event to attach the listener to.
	 * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addOnceListener = function addOnceListener(evt, listener) {
		return this.addListener(evt, {
			listener: listener,
			once: true
		});
	};

	/**
	 * Alias of addOnceListener.
	 */
	proto.once = alias('addOnceListener');

	/**
	 * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
	 * You need to tell it what event names should be matched by a regex.
	 *
	 * @param {String} evt Name of the event to create.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.defineEvent = function defineEvent(evt) {
		this.getListeners(evt);
		return this;
	};

	/**
	 * Uses defineEvent to define multiple events.
	 *
	 * @param {String[]} evts An array of event names to define.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.defineEvents = function defineEvents(evts) {
		for (var i = 0; i < evts.length; i += 1) {
			this.defineEvent(evts[i]);
		}
		return this;
	};

	/**
	 * Removes a listener function from the specified event.
	 * When passed a regular expression as the event name, it will remove the listener from all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to remove the listener from.
	 * @param {Function} listener Method to remove from the event.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeListener = function removeListener(evt, listener) {
		var listeners = this.getListenersAsObject(evt);
		var index;
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				index = indexOfListener(listeners[key], listener);

				if (index !== -1) {
					listeners[key].splice(index, 1);
				}
			}
		}

		return this;
	};

	/**
	 * Alias of removeListener
	 */
	proto.off = alias('removeListener');

	/**
	 * Adds listeners in bulk using the manipulateListeners method.
	 * If you pass an object as the second argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
	 * You can also pass it a regular expression to add the array of listeners to all events that match it.
	 * Yeah, this function does quite a bit. That's probably a bad thing.
	 *
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to add.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addListeners = function addListeners(evt, listeners) {
		// Pass through to manipulateListeners
		return this.manipulateListeners(false, evt, listeners);
	};

	/**
	 * Removes listeners in bulk using the manipulateListeners method.
	 * If you pass an object as the second argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	 * You can also pass it an event name and an array of listeners to be removed.
	 * You can also pass it a regular expression to remove the listeners from all events that match it.
	 *
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to remove.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeListeners = function removeListeners(evt, listeners) {
		// Pass through to manipulateListeners
		return this.manipulateListeners(true, evt, listeners);
	};

	/**
	 * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
	 * The first argument will determine if the listeners are removed (true) or added (false).
	 * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	 * You can also pass it an event name and an array of listeners to be added/removed.
	 * You can also pass it a regular expression to manipulate the listeners of all events that match it.
	 *
	 * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
		var i;
		var value;
		var single = remove ? this.removeListener : this.addListener;
		var multiple = remove ? this.removeListeners : this.addListeners;

		// If evt is an object then pass each of it's properties to this method
		if (typeof evt === 'object' && !(evt instanceof RegExp)) {
			for (i in evt) {
				if (evt.hasOwnProperty(i) && (value = evt[i])) {
					// Pass the single listener straight through to the singular method
					if (typeof value === 'function') {
						single.call(this, i, value);
					}
					else {
						// Otherwise pass back to the multiple function
						multiple.call(this, i, value);
					}
				}
			}
		}
		else {
			// So evt must be a string
			// And listeners must be an array of listeners
			// Loop over it and pass each one to the multiple method
			i = listeners.length;
			while (i--) {
				single.call(this, evt, listeners[i]);
			}
		}

		return this;
	};

	/**
	 * Removes all listeners from a specified event.
	 * If you do not specify an event then all listeners will be removed.
	 * That means every event will be emptied.
	 * You can also pass a regex to remove all events that match it.
	 *
	 * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeEvent = function removeEvent(evt) {
		var type = typeof evt;
		var events = this._getEvents();
		var key;

		// Remove different things depending on the state of evt
		if (type === 'string') {
			// Remove all listeners for the specified event
			delete events[evt];
		}
		else if (type === 'object') {
			// Remove all events matching the regex.
			for (key in events) {
				if (events.hasOwnProperty(key) && evt.test(key)) {
					delete events[key];
				}
			}
		}
		else {
			// Remove all listeners in all events
			delete this._events;
		}

		return this;
	};

	/**
	 * Emits an event of your choice.
	 * When emitted, every listener attached to that event will be executed.
	 * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
	 * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
	 * So they will not arrive within the array on the other side, they will be separate.
	 * You can also pass a regular expression to emit to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	 * @param {Array} [args] Optional array of arguments to be passed to each listener.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.emitEvent = function emitEvent(evt, args) {
		var listeners = this.getListenersAsObject(evt);
		var listener;
		var i;
		var key;
		var response;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				i = listeners[key].length;

				while (i--) {
					// If the listener returns true then it shall be removed from the event
					// The function is executed either with a basic call or an apply if there is an args array
					listener = listeners[key][i];
					response = listener.listener.apply(this, args || []);
					if (response === this._getOnceReturnValue() || listener.once === true) {
						this.removeListener(evt, listener.listener);
					}
				}
			}
		}

		return this;
	};

	/**
	 * Alias of emitEvent
	 */
	proto.trigger = alias('emitEvent');

	/**
	 * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
	 * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	 * @param {...*} Optional additional arguments to be passed to each listener.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.emit = function emit(evt) {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.emitEvent(evt, args);
	};

	/**
	 * Sets the current value to check against when executing listeners. If a
	 * listeners return value matches the one set here then it will be removed
	 * after execution. This value defaults to true.
	 *
	 * @param {*} value The new value to check for when executing listeners.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.setOnceReturnValue = function setOnceReturnValue(value) {
		this._onceReturnValue = value;
		return this;
	};

	/**
	 * Fetches the current value to check against when executing listeners. If
	 * the listeners return value matches this one then it should be removed
	 * automatically. It will return true by default.
	 *
	 * @return {*|Boolean} The current value to check for or the default, true.
	 * @api private
	 */
	proto._getOnceReturnValue = function _getOnceReturnValue() {
		if (this.hasOwnProperty('_onceReturnValue')) {
			return this._onceReturnValue;
		}
		else {
			return true;
		}
	};

	/**
	 * Fetches the events object and creates one if required.
	 *
	 * @return {Object} The events storage object.
	 * @api private
	 */
	proto._getEvents = function _getEvents() {
		return this._events || (this._events = {});
	};

	// Expose the class either via AMD, CommonJS or the global object
	if (typeof define === 'function' && define.amd) {
		define('eventEmitter/EventEmitter',[],function () {
			return EventEmitter;
		});
	}
	else if (typeof module === 'object' && module.exports){
		module.exports = EventEmitter;
	}
	else {
		this.EventEmitter = EventEmitter;
	}
}.call(this));

/*!
 * eventie v1.0.3
 * event binding helper
 *   eventie.bind( elem, 'click', myFn )
 *   eventie.unbind( elem, 'click', myFn )
 */

/*jshint browser: true, undef: true, unused: true */
/*global define: false */

( function( window ) {



var docElem = document.documentElement;

var bind = function() {};

if ( docElem.addEventListener ) {
  bind = function( obj, type, fn ) {
    obj.addEventListener( type, fn, false );
  };
} else if ( docElem.attachEvent ) {
  bind = function( obj, type, fn ) {
    obj[ type + fn ] = fn.handleEvent ?
      function() {
        var event = window.event;
        // add event.target
        event.target = event.target || event.srcElement;
        fn.handleEvent.call( fn, event );
      } :
      function() {
        var event = window.event;
        // add event.target
        event.target = event.target || event.srcElement;
        fn.call( obj, event );
      };
    obj.attachEvent( "on" + type, obj[ type + fn ] );
  };
}

var unbind = function() {};

if ( docElem.removeEventListener ) {
  unbind = function( obj, type, fn ) {
    obj.removeEventListener( type, fn, false );
  };
} else if ( docElem.detachEvent ) {
  unbind = function( obj, type, fn ) {
    obj.detachEvent( "on" + type, obj[ type + fn ] );
    try {
      delete obj[ type + fn ];
    } catch ( err ) {
      // can't delete window object properties
      obj[ type + fn ] = undefined;
    }
  };
}

var eventie = {
  bind: bind,
  unbind: unbind
};

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'eventie/eventie',eventie );
} else {
  // browser global
  window.eventie = eventie;
}

})( this );

/*!
 * getStyleProperty by kangax
 * http://perfectionkills.com/feature-testing-css-properties/
 */

/*jshint browser: true, strict: true, undef: true */
/*globals define: false */

( function( window ) {



var prefixes = 'Webkit Moz ms Ms O'.split(' ');
var docElemStyle = document.documentElement.style;

function getStyleProperty( propName ) {
  if ( !propName ) {
    return;
  }

  // test standard property first
  if ( typeof docElemStyle[ propName ] === 'string' ) {
    return propName;
  }

  // capitalize
  propName = propName.charAt(0).toUpperCase() + propName.slice(1);

  // test vendor specific properties
  var prefixed;
  for ( var i=0, len = prefixes.length; i < len; i++ ) {
    prefixed = prefixes[i] + propName;
    if ( typeof docElemStyle[ prefixed ] === 'string' ) {
      return prefixed;
    }
  }
}

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'get-style-property/get-style-property',[],function() {
    return getStyleProperty;
  });
} else {
  // browser global
  window.getStyleProperty = getStyleProperty;
}

})( window );

/**
 * getSize v1.1.4
 * measure size of elements
 */

/*jshint browser: true, strict: true, undef: true, unused: true */
/*global define: false */

( function( window, undefined ) {



// -------------------------- helpers -------------------------- //

var defView = document.defaultView;

var getStyle = defView && defView.getComputedStyle ?
  function( elem ) {
    return defView.getComputedStyle( elem, null );
  } :
  function( elem ) {
    return elem.currentStyle;
  };

// get a number from a string, not a percentage
function getStyleSize( value ) {
  var num = parseFloat( value );
  // not a percent like '100%', and a number
  var isValid = value.indexOf('%') === -1 && !isNaN( num );
  return isValid && num;
}

// -------------------------- measurements -------------------------- //

var measurements = [
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'marginBottom',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'borderBottomWidth'
];

function getZeroSize() {
  var size = {
    width: 0,
    height: 0,
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0
  };
  for ( var i=0, len = measurements.length; i < len; i++ ) {
    var measurement = measurements[i];
    size[ measurement ] = 0;
  }
  return size;
}



function defineGetSize( getStyleProperty ) {

// -------------------------- box sizing -------------------------- //

var boxSizingProp = getStyleProperty('boxSizing');
var isBoxSizeOuter;

/**
 * WebKit measures the outer-width on style.width on border-box elems
 * IE & Firefox measures the inner-width
 */
( function() {
  if ( !boxSizingProp ) {
    return;
  }

  var div = document.createElement('div');
  div.style.width = '200px';
  div.style.padding = '1px 2px 3px 4px';
  div.style.borderStyle = 'solid';
  div.style.borderWidth = '1px 2px 3px 4px';
  div.style[ boxSizingProp ] = 'border-box';

  var body = document.body || document.documentElement;
  body.appendChild( div );
  var style = getStyle( div );

  isBoxSizeOuter = getStyleSize( style.width ) === 200;
  body.removeChild( div );
})();


// -------------------------- getSize -------------------------- //

function getSize( elem ) {
  // use querySeletor if elem is string
  if ( typeof elem === 'string' ) {
    elem = document.querySelector( elem );
  }

  // do not proceed on non-objects
  if ( !elem || typeof elem !== 'object' || !elem.nodeType ) {
    return;
  }

  var style = getStyle( elem );

  // if hidden, everything is 0
  if ( style.display === 'none' ) {
    return getZeroSize();
  }

  var size = {};
  size.width = elem.offsetWidth;
  size.height = elem.offsetHeight;

  var isBorderBox = size.isBorderBox = !!( boxSizingProp &&
    style[ boxSizingProp ] && style[ boxSizingProp ] === 'border-box' );

  // get all measurements
  for ( var i=0, len = measurements.length; i < len; i++ ) {
    var measurement = measurements[i];
    var value = style[ measurement ];
    var num = parseFloat( value );
    // any 'auto', 'medium' value will be 0
    size[ measurement ] = !isNaN( num ) ? num : 0;
  }

  var paddingWidth = size.paddingLeft + size.paddingRight;
  var paddingHeight = size.paddingTop + size.paddingBottom;
  var marginWidth = size.marginLeft + size.marginRight;
  var marginHeight = size.marginTop + size.marginBottom;
  var borderWidth = size.borderLeftWidth + size.borderRightWidth;
  var borderHeight = size.borderTopWidth + size.borderBottomWidth;

  var isBorderBoxSizeOuter = isBorderBox && isBoxSizeOuter;

  // overwrite width and height if we can get it from style
  var styleWidth = getStyleSize( style.width );
  if ( styleWidth !== false ) {
    size.width = styleWidth +
      // add padding and border unless it's already including it
      ( isBorderBoxSizeOuter ? 0 : paddingWidth + borderWidth );
  }

  var styleHeight = getStyleSize( style.height );
  if ( styleHeight !== false ) {
    size.height = styleHeight +
      // add padding and border unless it's already including it
      ( isBorderBoxSizeOuter ? 0 : paddingHeight + borderHeight );
  }

  size.innerWidth = size.width - ( paddingWidth + borderWidth );
  size.innerHeight = size.height - ( paddingHeight + borderHeight );

  size.outerWidth = size.width + marginWidth;
  size.outerHeight = size.height + marginHeight;

  return size;
}

return getSize;

}

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'get-size/get-size',[ 'get-style-property/get-style-property' ], defineGetSize );
} else {
  // browser global
  window.getSize = defineGetSize( window.getStyleProperty );
}

})( window );

/*!
 * Draggabilly v1.1.1
 * Make that shiz draggable
 * http://draggabilly.desandro.com
 * MIT license
 */

( function( window ) {



// vars
var document = window.document;

// -------------------------- helpers -------------------------- //

// extend objects
function extend( a, b ) {
  for ( var prop in b ) {
    a[ prop ] = b[ prop ];
  }
  return a;
}

function noop() {}

// ----- get style ----- //

var defView = document.defaultView;

var getStyle = defView && defView.getComputedStyle ?
  function( elem ) {
    return defView.getComputedStyle( elem, null );
  } :
  function( elem ) {
    return elem.currentStyle;
  };


// http://stackoverflow.com/a/384380/182183
var isElement = ( typeof HTMLElement === 'object' ) ?
  function isElementDOM2( obj ) {
    return obj instanceof HTMLElement;
  } :
  function isElementQuirky( obj ) {
    return obj && typeof obj === 'object' &&
      obj.nodeType === 1 && typeof obj.nodeName === 'string';
  };

// -------------------------- requestAnimationFrame -------------------------- //

// https://gist.github.com/1866474

var lastTime = 0;
var prefixes = 'webkit moz ms o'.split(' ');
// get unprefixed rAF and cAF, if present
var requestAnimationFrame = window.requestAnimationFrame;
var cancelAnimationFrame = window.cancelAnimationFrame;
// loop through vendor prefixes and get prefixed rAF and cAF
var prefix;
for( var i = 0; i < prefixes.length; i++ ) {
  if ( requestAnimationFrame && cancelAnimationFrame ) {
    break;
  }
  prefix = prefixes[i];
  requestAnimationFrame = requestAnimationFrame || window[ prefix + 'RequestAnimationFrame' ];
  cancelAnimationFrame  = cancelAnimationFrame  || window[ prefix + 'CancelAnimationFrame' ] ||
                            window[ prefix + 'CancelRequestAnimationFrame' ];
}

// fallback to setTimeout and clearTimeout if either request/cancel is not supported
if ( !requestAnimationFrame || !cancelAnimationFrame )  {
  requestAnimationFrame = function( callback ) {
    var currTime = new Date().getTime();
    var timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
    var id = window.setTimeout( function() {
      callback( currTime + timeToCall );
    }, timeToCall );
    lastTime = currTime + timeToCall;
    return id;
  };

  cancelAnimationFrame = function( id ) {
    window.clearTimeout( id );
  };
}

// -------------------------- definition -------------------------- //

function draggabillyDefinition( classie, EventEmitter, eventie, getStyleProperty, getSize ) {

// -------------------------- support -------------------------- //

var transformProperty = getStyleProperty('transform');
// TODO fix quick & dirty check for 3D support
var is3d = !!getStyleProperty('perspective');

// --------------------------  -------------------------- //

function Draggabilly( element, options ) {
  // querySelector if string
  this.element = typeof element === 'string' ?
    document.querySelector( element ) : element;

  this.options = extend( {}, this.options );
  extend( this.options, options );

  this._create();
}

// inherit EventEmitter methods
extend( Draggabilly.prototype, EventEmitter.prototype );

Draggabilly.prototype.options = {
};

Draggabilly.prototype._create = function() {

  // properties
  this.position = {};
  this._getPosition();

  this.startPoint = { x: 0, y: 0 };
  this.dragPoint = { x: 0, y: 0 };

  this.startPosition = extend( {}, this.position );

  // set relative positioning
  var style = getStyle( this.element );
  if ( style.position !== 'relative' && style.position !== 'absolute' ) {
    this.element.style.position = 'relative';
  }

  this.enable();
  this.setHandles();

};

/**
 * set this.handles and bind start events to 'em
 */
Draggabilly.prototype.setHandles = function() {
  this.handles = this.options.handle ?
    this.element.querySelectorAll( this.options.handle ) : [ this.element ];

  for ( var i=0, len = this.handles.length; i < len; i++ ) {
    var handle = this.handles[i];
    // bind pointer start event
    if ( window.navigator.pointerEnabled ) {
      // W3C Pointer Events, IE11. See https://coderwall.com/p/mfreca
      eventie.bind( handle, 'pointerdown', this );
      // disable scrolling on the element
      handle.style.touchAction = 'none';
    } else if ( window.navigator.msPointerEnabled ) {
      // IE10 Pointer Events
      eventie.bind( handle, 'MSPointerDown', this );
      // disable scrolling on the element
      handle.style.msTouchAction = 'none';
    } else {
      // listen for both, for devices like Chrome Pixel
      //   which has touch and mouse events
      eventie.bind( handle, 'mousedown', this );
      eventie.bind( handle, 'touchstart', this );
      disableImgOndragstart( handle );
    }
  }
};

// remove default dragging interaction on all images in IE8
// IE8 does its own drag thing on images, which messes stuff up

function noDragStart() {
  return false;
}

// TODO replace this with a IE8 test
var isIE8 = 'attachEvent' in document.documentElement;

// IE8 only
var disableImgOndragstart = !isIE8 ? noop : function( handle ) {

  if ( handle.nodeName === 'IMG' ) {
    handle.ondragstart = noDragStart;
  }

  var images = handle.querySelectorAll('img');
  for ( var i=0, len = images.length; i < len; i++ ) {
    var img = images[i];
    img.ondragstart = noDragStart;
  }
};


// get left/top position from style
Draggabilly.prototype._getPosition = function() {
  // properties
  var style = getStyle( this.element );

  var x = parseInt( style.left, 10 );
  var y = parseInt( style.top, 10 );

  // clean up 'auto' or other non-integer values
  this.position.x = isNaN( x ) ? 0 : x;
  this.position.y = isNaN( y ) ? 0 : y;

  this._addTransformPosition( style );
};

// add transform: translate( x, y ) to position
Draggabilly.prototype._addTransformPosition = function( style ) {
  if ( !transformProperty ) {
    return;
  }
  var transform = style[ transformProperty ];
  // bail out if value is 'none'
  if ( transform.indexOf('matrix') !== 0 ) {
    return;
  }
  // split matrix(1, 0, 0, 1, x, y)
  var matrixValues = transform.split(',');
  // translate X value is in 12th or 4th position
  var xIndex = transform.indexOf('matrix3d') === 0 ? 12 : 4;
  var translateX = parseInt( matrixValues[ xIndex ], 10 );
  // translate Y value is in 13th or 5th position
  var translateY = parseInt( matrixValues[ xIndex + 1 ], 10 );
  this.position.x += translateX;
  this.position.y += translateY;
};

// -------------------------- events -------------------------- //

// trigger handler methods for events
Draggabilly.prototype.handleEvent = function( event ) {
  var method = 'on' + event.type;
  if ( this[ method ] ) {
    this[ method ]( event );
  }
};

// returns the touch that we're keeping track of
Draggabilly.prototype.getTouch = function( touches ) {
  for ( var i=0, len = touches.length; i < len; i++ ) {
    var touch = touches[i];
    if ( touch.identifier === this.pointerIdentifier ) {
      return touch;
    }
  }
};

// ----- start event ----- //

Draggabilly.prototype.onmousedown = function( event ) {
  // dismiss clicks from right or middle buttons
  var button = event.button;
  if ( button && ( button !== 0 && button !== 1 ) ) {
    return;
  }
  this.dragStart( event, event );
};

Draggabilly.prototype.ontouchstart = function( event ) {
  // disregard additional touches
  if ( this.isDragging ) {
    return;
  }

  this.dragStart( event, event.changedTouches[0] );
};

Draggabilly.prototype.onMSPointerDown =
Draggabilly.prototype.onpointerdown = function( event ) {
  // disregard additional touches
  if ( this.isDragging ) {
    return;
  }

  this.dragStart( event, event );
};

function setPointerPoint( point, pointer ) {
  point.x = pointer.pageX !== undefined ? pointer.pageX : pointer.clientX;
  point.y = pointer.pageY !== undefined ? pointer.pageY : pointer.clientY;
}

// hash of events to be bound after start event
var postStartEvents = {
  mousedown: [ 'mousemove', 'mouseup' ],
  touchstart: [ 'touchmove', 'touchend', 'touchcancel' ],
  pointerdown: [ 'pointermove', 'pointerup', 'pointercancel' ],
  MSPointerDown: [ 'MSPointerMove', 'MSPointerUp', 'MSPointerCancel' ]
};

/**
 * drag start
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragStart = function( event, pointer ) {
  if ( !this.isEnabled ) {
    return;
  }

  if ( event.preventDefault ) {
    event.preventDefault();
  } else {
    event.returnValue = false;
  }

  // save pointer identifier to match up touch events
  this.pointerIdentifier = pointer.pointerId !== undefined ?
    // pointerId for pointer events, touch.indentifier for touch events
    pointer.pointerId : pointer.identifier;

  this._getPosition();

  this.measureContainment();

  // point where drag began
  setPointerPoint( this.startPoint, pointer );
  // position _when_ drag began
  this.startPosition.x = this.position.x;
  this.startPosition.y = this.position.y;

  // reset left/top style
  this.setLeftTop();

  this.dragPoint.x = 0;
  this.dragPoint.y = 0;

  // bind move and end events
  this._bindEvents({
    // get proper events to match start event
    events: postStartEvents[ event.type ],
    // IE8 needs to be bound to document
    node: event.preventDefault ? window : document
  });

  classie.add( this.element, 'is-dragging' );

  // reset isDragging flag
  this.isDragging = true;

  this.emitEvent( 'dragStart', [ this, event, pointer ] );

  // start animation
  this.animate();
};

Draggabilly.prototype._bindEvents = function( args ) {
  for ( var i=0, len = args.events.length; i < len; i++ ) {
    var event = args.events[i];
    eventie.bind( args.node, event, this );
  }
  // save these arguments
  this._boundEvents = args;
};

Draggabilly.prototype._unbindEvents = function() {
  var args = this._boundEvents;
  // IE8 can trigger dragEnd twice, check for _boundEvents
  if ( !args || !args.events ) {
    return;
  }

  for ( var i=0, len = args.events.length; i < len; i++ ) {
    var event = args.events[i];
    eventie.unbind( args.node, event, this );
  }
  delete this._boundEvents;
};

Draggabilly.prototype.measureContainment = function() {
  var containment = this.options.containment;
  if ( !containment ) {
    return;
  }

  this.size = getSize( this.element );
  var elemRect = this.element.getBoundingClientRect();

  // use element if element
  var container = isElement( containment ) ? containment :
    // fallback to querySelector if string
    typeof containment === 'string' ? document.querySelector( containment ) :
    // otherwise just `true`, use the parent
    this.element.parentNode;

  this.containerSize = getSize( container );
  var containerRect = container.getBoundingClientRect();

  this.relativeStartPosition = {
    x: elemRect.left - containerRect.left,
    y: elemRect.top  - containerRect.top
  };
};

// ----- move event ----- //

Draggabilly.prototype.onmousemove = function( event ) {
  this.dragMove( event, event );
};

Draggabilly.prototype.onMSPointerMove =
Draggabilly.prototype.onpointermove = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragMove( event, event );
  }
};

Draggabilly.prototype.ontouchmove = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  if ( touch ) {
    this.dragMove( event, touch );
  }
};

/**
 * drag move
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragMove = function( event, pointer ) {

  setPointerPoint( this.dragPoint, pointer );
  var dragX = this.dragPoint.x - this.startPoint.x;
  var dragY = this.dragPoint.y - this.startPoint.y;

  var grid = this.options.grid;
  var gridX = grid && grid[0];
  var gridY = grid && grid[1];

  dragX = applyGrid( dragX, gridX );
  dragY = applyGrid( dragY, gridY );

  dragX = this.containDrag( 'x', dragX, gridX );
  dragY = this.containDrag( 'y', dragY, gridY );

  // constrain to axis
  dragX = this.options.axis === 'y' ? 0 : dragX;
  dragY = this.options.axis === 'x' ? 0 : dragY;

  this.position.x = this.startPosition.x + dragX;
  this.position.y = this.startPosition.y + dragY;
  // set dragPoint properties
  this.dragPoint.x = dragX;
  this.dragPoint.y = dragY;

  this.emitEvent( 'dragMove', [ this, event, pointer ] );
};

function applyGrid( value, grid, method ) {
  method = method || 'round';
  return grid ? Math[ method ]( value / grid ) * grid : value;
}

Draggabilly.prototype.containDrag = function( axis, drag, grid ) {
  if ( !this.options.containment ) {
    return drag;
  }
  var measure = axis === 'x' ? 'width' : 'height';

  var rel = this.relativeStartPosition[ axis ];
  var min = applyGrid( -rel, grid, 'ceil' );
  var max = this.containerSize[ measure ] - rel - this.size[ measure ];
  max = applyGrid( max, grid, 'floor' );
  return  Math.min( max, Math.max( min, drag ) );
};

// ----- end event ----- //

Draggabilly.prototype.onmouseup = function( event ) {
  this.dragEnd( event, event );
};

Draggabilly.prototype.onMSPointerUp =
Draggabilly.prototype.onpointerup = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragEnd( event, event );
  }
};

Draggabilly.prototype.ontouchend = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  if ( touch ) {
    this.dragEnd( event, touch );
  }
};

/**
 * drag end
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragEnd = function( event, pointer ) {
  this.isDragging = false;

  delete this.pointerIdentifier;

  // use top left position when complete
  if ( transformProperty ) {
    this.element.style[ transformProperty ] = '';
    this.setLeftTop();
  }

  // remove events
  this._unbindEvents();

  classie.remove( this.element, 'is-dragging' );

  this.emitEvent( 'dragEnd', [ this, event, pointer ] );

};

// ----- cancel event ----- //

// coerce to end event

Draggabilly.prototype.onMSPointerCancel =
Draggabilly.prototype.onpointercancel = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragEnd( event, event );
  }
};

Draggabilly.prototype.ontouchcancel = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  this.dragEnd( event, touch );
};

// -------------------------- animation -------------------------- //

Draggabilly.prototype.animate = function() {
  // only render and animate if dragging
  if ( !this.isDragging ) {
    return;
  }

  this.positionDrag();

  var _this = this;
  requestAnimationFrame( function animateFrame() {
    _this.animate();
  });

};

// transform translate function
var translate = is3d ?
  function( x, y, degs) {
    return 'translate3d( ' + x + 'px, ' + y + 'px, 0) rotate(' + degs + 'deg)';
  } :
  function( x, y, degs ) {
    return 'translate( ' + x + 'px, ' + y + 'px) rotate(' + degs + 'deg)';
  };

// left/top positioning
Draggabilly.prototype.setLeftTop = function() {
  this.element.style.left = this.position.x + 'px';
  this.element.style.top  = this.position.y + 'px';
  this.element.style[ transformProperty ] = 'rotate(' + (this.options.rotation || 0 )  + 'deg)';
};

Draggabilly.prototype.positionDrag = transformProperty ?
  function() {
    // position with transform
    this.element.style[ transformProperty ] = translate( this.dragPoint.x, this.dragPoint.y, this.options.rotation || 0 );
  } : Draggabilly.prototype.setLeftTop;

Draggabilly.prototype.enable = function() {
  this.isEnabled = true;
};

Draggabilly.prototype.disable = function() {
  this.isEnabled = false;
  if ( this.isDragging ) {
    this.dragEnd();
  }
};

return Draggabilly;

} // end definition

// -------------------------- transport -------------------------- //

if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'components/adapt-peelBackHotspot/js/draggabilly',[
      'classie/classie',
      'eventEmitter/EventEmitter',
      'eventie/eventie',
      'get-style-property/get-style-property',
      'get-size/get-size'
    ],
    draggabillyDefinition );
} else if ( typeof exports === 'object' ) {
  // CommonJS
  module.exports = draggabillyDefinition(
    require('desandro-classie'),
    require('wolfy87-eventemitter'),
    require('eventie'),
    require('desandro-get-style-property'),
    require('get-size')
  );
} else {
  // browser global
  window.Draggabilly = draggabillyDefinition(
    window.classie,
    window.EventEmitter,
    window.eventie,
    window.getStyleProperty,
    window.getSize
  );
}

})( window );

/*
* adapt-peelBackHotspot
* Version - 0.0.0
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>
*/
define('components/adapt-peelBackHotspot/js/adapt-peelBackHotspot',['require','coreViews/componentView','coreJS/adapt','components/adapt-peelBackHotspot/js/draggabilly','components/adapt-contrib-accordion/js/adapt-contrib-accordion'],function(require) {

	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');
	var Draggabilly = require('components/adapt-peelBackHotspot/js/draggabilly');

    var peelbackhotspot = ComponentView.extend({
        isAccordian: false,

    	events: {
    		"click .peelbackhotspot-button": "onButtonClick",
            "touchend .peelbackhotspot-button": "onButtonClick",
            "click .peelbackhotspot-hotspot": "onHotspotClick",
            "touchend .peelbackhotspot-hotspot": "onHotspotClick",
            "click .peelbackhotspot-infobox": "onHotspotClick",
            "touchend .peelbackhotspot-infobox": "onHotspotClick",
    	},

        preRender: function() {

        },

        postRender: function() {
        	this.$boundary = this.$('#peelbackhotspot-track');
        	this.$el.imageready(_.bind(function() {

                this.onResize();

	        	this.setReadyStatus();
	        	var item = this.$('.peelbackhotspot-button')[0];
	        	item._dragger = new Draggabilly(item, {
	                containment: true,
	                axis: 'x'
	            });
	            item._dragger.on("dragStart", _.bind(this.dragStart, this));
	            item._dragger.on("dragMove", _.bind(this.dragMove, this));
	            item._dragger.on("dragEnd", _.bind(this.dragEnd, this));

                this.checkCompletion();

	        }, this));
            this.listenTo(Adapt, "device:resize", this.onResize);
        },

        reRender: function() {
            if (Adapt.device.screenSize != 'large' && this.model.get("_isAccordianOnMobile")) {
                if (!this.isAccordian) this.replaceWithAccordion();
                return this.isAccordian = true;
            } else {
                if (this.isAccordian) this.replaceWithPeelBackHotspot();
                return this.isAccordian = false;
            }
        },

        replaceWithAccordion: function() {
          var Accordion = require('components/adapt-contrib-accordion/js/adapt-contrib-accordion');
          var model = this.prepareAccordionModel();
          model.set('_component', 'accordion');
          this.newAccordion = new Accordion({model:model, $parent: this.options.$parent});
          this.newAccordion.preRender();
          this.newAccordion.postRender();
          model.set('_component', 'peelbackhotspot');
          this.options.$parent.html("");
          this.options.$parent.append(this.newAccordion.$el);
          this.stopListening(Adapt, 'device:resize');
          Adapt.trigger('device:resize');
          this.undelegateEvents();
          this.listenTo(Adapt, "device:resize", this.onResize);

        },

        prepareAccordionModel: function() {
          var model = this.model;
          if (model.get('_wasPeelBackHotspot')) return model;
          model.set('_wasPeelBackHotspot', true);
          model.set('originalBody', model.get('body'));
          model.set('originalTitle', model.get('displayTitle'));
          if (model.get('mobileBody')) {
            model.set('body', model.get('mobileBody'));
          }
          if (model.get('mobileTitle')) {
            model.set('displayTitle', model.get('mobileTitle'));
          }
          return model;
        },

        replaceWithPeelBackHotspot: function() {
          this.newAccordion.remove();
          this.preparePeelBackHotspotModel();
          this.render();
          this.options.$parent.append(this.$el);
          this.stopListening(Adapt, 'device:resize');
          Adapt.trigger('device:resize');
          this.listenTo(Adapt, "device:resize", this.onResize);
          this.delegateEvents();
        },

        preparePeelBackHotspotModel: function() {
            var model = this.model;
            this.isRevealed = false;
            if (!model.get('_wasPeelBackHotspot')) return;
            model.set('_wasPeelBackHotspot', false);
            if (model.get('mobileBody')) {
                model.set('body', model.get('originalBody'));
            }
            if (model.get('mobileTitle')) {
                model.set('displayTitle', model.get('originalTitle'));
            }
            return model;
        },


        onResize: function() {
            if (this.reRender()) return;

            var size = this.$('.peelbackhotspot-button').outerWidth();

            this.$('.peelbackhotspot-foreground').css({
                height: this.model.get("_reveal")._maxHeight[Adapt.device.screenSize] 
            });
            this.$('.peelbackhotspot-foreground').css({
                left:  ((this.$('.peelbackhotspot-imageboard').width() / 2)  - (this.$('.peelbackhotspot-foreground').width() / 2)) + "px"
            });
            this.$('.peelbackhotspot-overlaycontainer').css({
                width: this.$('.peelbackhotspot-imageboard').width() - size + "px",
                left:  (size / 2) + "px"
            });
            this.$('.peelbackhotspot-background').css({
                width: this.$('.peelbackhotspot-foreground').width() + "px",
                left: ((this.$('.peelbackhotspot-imageboard').width() / 2)  - (this.$('.peelbackhotspot-foreground').width() / 2)) - (size / 2) + "px"
            });
            this.$('.peelbackhotspot-hotspots').css({
                width: this.$('.peelbackhotspot-foreground').width() + "px",
                left: ((this.$('.peelbackhotspot-imageboard').width() / 2)  - (this.$('.peelbackhotspot-foreground').width() / 2)) - (size / 2) + "px"
            });
            if (this.isRevealed) {
                var offsetX = this.$('#peelbackhotspot-track').width() - (size + 1);
                this.$('.peelbackhotspot-button, .peelbackhotspot-button-image').css({
                    left: offsetX + "px"
                });
            } else {
                var offsetX = this.$('#peelbackhotspot-track').width() - (size + 1);
                this.$('.peelbackhotspot-button, .peelbackhotspot-button-image').css({
                    left: "0px"
                });
            }
        },

        dragStart: function(instance, event) {
            console.log("dragStart");
        	this.startState = this.isRevealed;
        },

        dragMove: function(instance, event) {
            var size = this.$('.peelbackhotspot-button').outerWidth();

            this.inDrag = true;
        	var boundaryOffset = this.$boundary.offset();

            var pagePoint;
            var $ele = $(instance.element);

            if (event.pageX !== 0) {
                if (event.clientY < boundaryOffset.top) {
                    event.pageX = event.clientX;
                    event.pageY = event.clientY;
                }
                pagePoint = {
                    left: event.pageX - size / 2,
                    top: event.pageY
                };
            } else {
                var $elePosition = $ele.position();
                pagePoint = {
                    left: $elePosition.left  + size / 2,
                    top: $elePosition.top
                };
            }

        
            var pointAsPixel = {
                left: ((pagePoint.left - boundaryOffset.left)),
                top:  ((pagePoint.top - boundaryOffset.top))
            };

            var offsetX = this.$('#peelbackhotspot-track').width() - (size  + 1);

            var pointAsPercent = {
                left: ((100 / offsetX) * (pointAsPixel.left))
            };

            if (pointAsPercent.left > 100) pointAsPercent.left = 100;
            if (pointAsPercent.left < 0) pointAsPercent.left = 0;

            this.$('.peelbackhotspot-hider').css({
            	width: pointAsPercent.left + '%'
            });
            this.$('.peelbackhotspot-button-image').css({
                left: this.$('.peelbackhotspot-button').position().left + "px"
            });


            if (pointAsPercent.left < 50) {
                if (!this.model.get("_reveal")._button._img) this.$('.peelbackhotspot-button').html( this.model.get("_reveal")._button.textRight);
            } else {
                if (!this.model.get("_reveal")._button._img) this.$('.peelbackhotspot-button').html( this.model.get("_reveal")._button.textLeft);
            }

        },

        dragEnd: function(instance, event) {
            if ( this.inAnimate) return

            var size = this.$('.peelbackhotspot-button').outerWidth();

            
            _.defer(_.bind(function() {
                console.log("dragEnd");
                this.inAnimate = true;

                var offsetX = this.$('#peelbackhotspot-track').width() - (size  + 1);
                var percentageLeft = (100/offsetX) * this.$('.peelbackhotspot-button').position().left;
                var dragged = (percentageLeft > 98 && this.isRevealed ? false : percentageLeft < 2 && !this.isRevealed ? false : true);

                this.animate(dragged);
                this.inDrag = false;
            }, this));
        },


        onButtonClick: function(event) {
            if (event) event.preventDefault();
            if (this.inDrag) return;
            if ( this.inAnimate) return
            this.inAnimate = true;
            _.defer(_.bind(function() {
                console.log("click");
                this.animate(false);
            }, this));

        },

        animate: function(fromDrag) {
            var size = this.$('.peelbackhotspot-button').outerWidth();

            //this.$('.peelbackhotspot-button').attr("disabled","disabled");
            var offsetX = this.$('#peelbackhotspot-track').width() - (size + 1);
            var percentageLeft = (100/offsetX) * this.$('.peelbackhotspot-button').position().left;
            percentageLeft = (percentageLeft > 100 ? 100 : percentageLeft < 0 ? 0 : percentageLeft);

            // hidden: pickup and drop before halfway || isRevealed: drag over halfway left || isRevealed: click
            var inLeftHalf = (percentageLeft >= 0 && percentageLeft < 50);
            var inRightHalf = (percentageLeft <= 100 && percentageLeft > 50);

            var revealedClicked = ( fromDrag === false && this.isRevealed);
            var hiddenClicked = ( fromDrag === false && !this.isRevealed);
            
            var revealedClicked, hiddenClicked, fullDragLeft, fullDragRight;

            var size = this.$('.peelbackhotspot-button').outerWidth();

            if ( (inRightHalf && revealedClicked) || (inLeftHalf && fromDrag) ) {
                
                //this.$('.peelbackhotspot-hider').velocity({ width: "0%" }, "easeInSine");
                this.$('.peelbackhotspot-button').velocity({ left: "0px" } , { 
                    progress:  _.bind(function(elements, percentComplete) {

                        var offsetX = this.$('#peelbackhotspot-track').width() - (size  + 1);

                        var pointAsPercent = {
                            left: ((100 / offsetX) * ( $(elements).position().left ))
                        };

                        if (pointAsPercent.left > 100) pointAsPercent.left = 100;
                        if (pointAsPercent.left < 0) pointAsPercent.left = 0;

                        this.$('.peelbackhotspot-hider').css({
                            width: pointAsPercent.left + '%'
                        });
                        this.$('.peelbackhotspot-button-image').css({
                            left: $(elements).position().left + "px"
                        });

                        this.$('.peelbackhotspot-foreground').css('opacity','.98');
                        setTimeout(_.bind(function() {
                            this.$('.peelbackhotspot-foreground').css('opacity','1');
                            this.inAnimate = false;
                        }, this), 0);

                    },this),
                    complete: _.bind(function() {
                        if (!this.model.get("_reveal")._button._img) this.$('.peelbackhotspot-button').html(this.model.get("_reveal")._button.textLeft);
                        this.$('.peelbackhotspot-foreground').css('opacity','.98');
                        setTimeout(_.bind(function() {
                            this.$('.peelbackhotspot-foreground').css('opacity','1');
                        }, this), 0);
                        this.onRevealed(false);
                },this)}, "easeInSine");
                this.isRevealed = false;
            } else if ( (inLeftHalf && hiddenClicked) || (inRightHalf && fromDrag) ) {
                //this.$('.peelbackhotspot-hider').velocity({ width: "100%" }, "easeInSine");
                this.$('.peelbackhotspot-button').velocity({ left: offsetX + "px" } , { 
                    progress: _.bind(function(elements, percentComplete) {
                       
                        var offsetX = this.$('#peelbackhotspot-track').width() - (size  + 1);

                        var pointAsPercent = {
                            left: ((100 / offsetX) * ( $(elements).position().left ))
                        };

                        if (pointAsPercent.left > 100) pointAsPercent.left = 100;
                        if (pointAsPercent.left < 0) pointAsPercent.left = 0;

                        this.$('.peelbackhotspot-hider').css({
                            width: pointAsPercent.left + '%'
                        });

                        this.$('.peelbackhotspot-button-image').css({
                            left: $(elements).position().left + "px"
                        });



                    }, this),
                    complete: _.bind(function() {
                        if (!this.model.get("_reveal")._button._img) this.$('.peelbackhotspot-button').html(this.model.get("_reveal")._button.textRight);
                        this.inAnimate = false;
                        this.onRevealed(true);
                },this)}, "easeInSine");
                this.isRevealed = true;
            }

            this.dragTick = false;
        },

        checkCompletion: function() {
            var items = this.model.get("_items");
            var visited = _.reduce(items, function(memo, item) {
                return memo + (item._isVisited ? 1 : 0);
            }, 0);
            if (visited === items.length) this.setCompletionStatus();
        },

        onHotspotClick: function(event) {
            event.preventDefault();
            var $ele = $(event.currentTarget);
            var index = $ele.attr("data-id");
            var items = this.model.get("_items");
           
            items[index]._isVisited = true;

            if (items[index]._infoType === undefined) items[index]._infoType = "notify";

            switch (items[index]._infoType) {
            case "notify":
                this.showNotify(index);
                break;            
            case "infobox":
                this.toggleInfoBox(index);
                break;
            }

            this.checkCompletion();
            $ele.addClass("visited");

        },
        showNotify: function(index) {
            var items = this.model.get("_items");
            var popupObject = {
                title: items[index].title,
                body: items[index].body
            };
            Adapt.trigger('notify:popup', popupObject);
        },
        toggleInfoBox: function(index, force){
            var items = this.model.get("_items");
            var paddingPixels = this.model.get("_reveal")._infoboxPaddingPixels;
            if (paddingPixels === undefined) paddingPixels = {top:10,left:10};

            var infobox = this.$('#item-'+index+'.peelbackhotspot-infobox');
            if ((infobox.css("display") === "none" && force === undefined) || force === "reveal") {
                var html = '<div><div class="peelbackhotspot-infobox-title" role="heading"></div><div class="peelbackhotspot-infobox-body"></div></div>';
                var div = $(html);
                div.find('.peelbackhotspot-infobox-title').html(items[index].title);
                div.find('.peelbackhotspot-infobox-body').html(items[index].body);
                infobox.html("").append(div);
                infobox.fadeIn(1000);
                

                var img = this.$('.peelbackhotspot-background');
                var height = img.height();
                var width = img.width();

                var padding = {
                    top:10, 
                    left:10
                };
                padding.top = (100/height) * paddingPixels.top;
                padding.left = (100/width) * paddingPixels.left;

                var $pin = this.$('.peelbackhotspot-hotspot[data-id="'+index+'"]');
                var top = (((100/height) * ($pin.height() / 2)) + parseInt(items[index]._top)) - ((100/height) * infobox.outerHeight());
                if (top < padding.top) top = padding.top;

                var left;

                var pinleft = (100/width) * $pin.position().left;

                if (pinleft > 50) {
                    if (( pinleft + (100/width) * (infobox.width() / 2) ) > (100 - (padding.left*2)) ) left = ((100 - (padding.left*2)) - (((100/width) * (infobox.width())))) + padding.left;
                    else left = ( pinleft - (100/width) * (infobox.width() / 2) );
                } else {
                    if (( pinleft - (100/width) * (infobox.width() / 2) ) < padding.left ) left = padding.left;
                    else left = ( pinleft - (100/width) * (infobox.width() / 2) );
                }

                infobox.css({
                    top: top + "%",
                    left: left + "%"
                });

                items[index]._isVisited = true;

            } else if ((infobox.css("display") !== "none" && force === undefined) || force === "hide")  {
                infobox.css("display", "none");
                infobox.html("")
            }
        },
        onRevealed: function(isRevealed) {
            var items = this.model.get("_items");
            //this.$('.peelbackhotspot-button').removeAttr("disabled").focusNoScroll();
            if (isRevealed) {
                if (this.model.get("_reveal") && this.model.get("_reveal")._isInfoBoxAriaOnly !== true) {
                    this.$('.peelbackhotspot-hotspot').attr("tabindex", 0);
                }
                _.each(items, _.bind(function(item, index) {
                    if (item._infoType === undefined) item._infoType = "notify";
                    switch (item._infoType) {
                    case "notify":
                        break;
                    case "infobox":
                        if (item._isInfoBoxShown) {
                            this.toggleInfoBox(index, "reveal");
                        }
                    }
                }, this));
                this.checkCompletion();
            } else {
                this.$('.peelbackhotspot-hotspot').attr("tabindex", -1);
                _.each(items, _.bind(function(item, index) {
                    if (item._infoType === undefined) item._infoType = "notify";
                    switch (item._infoType) {
                    case "notify":
                        break;
                    case "infobox":
                        if (item._isInfoBoxShown) {
                            this.toggleInfoBox(index, "hide");
                        }
                    }
                }, this));
            }
        }

        
    });
    
    Adapt.register("peelbackhotspot", peelbackhotspot );

    if ($.fn.focusNoScroll === undefined) $.fn.focusNoScroll = function(){
      var y = $(window).scrollTop();
      this[0].focus();
      window.scrollTo(null, y);
      return this; //chainability
    };

    
});
/*!
 * Draggabilly PACKAGED v1.1.2
 * Make that shiz draggable
 * http://draggabilly.desandro.com
 * MIT license
 */

/*!
 * classie - class helper functions
 * from bonzo https://github.com/ded/bonzo
 * 
 * classie.has( elem, 'my-class' ) -> true/false
 * classie.add( elem, 'my-new-class' )
 * classie.remove( elem, 'my-unwanted-class' )
 * classie.toggle( elem, 'my-class' )
 */

/*jshint browser: true, strict: true, undef: true */
/*global define: false */

( function( window ) {



// class helper functions from bonzo https://github.com/ded/bonzo

function classReg( className ) {
  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
}

// classList support for class management
// altho to be fair, the api sucks because it won't accept multiple classes at once
var hasClass, addClass, removeClass;

if ( 'classList' in document.documentElement ) {
  hasClass = function( elem, c ) {
    return elem.classList.contains( c );
  };
  addClass = function( elem, c ) {
    elem.classList.add( c );
  };
  removeClass = function( elem, c ) {
    elem.classList.remove( c );
  };
}
else {
  hasClass = function( elem, c ) {
    return classReg( c ).test( elem.className );
  };
  addClass = function( elem, c ) {
    if ( !hasClass( elem, c ) ) {
      elem.className = elem.className + ' ' + c;
    }
  };
  removeClass = function( elem, c ) {
    elem.className = elem.className.replace( classReg( c ), ' ' );
  };
}

function toggleClass( elem, c ) {
  var fn = hasClass( elem, c ) ? removeClass : addClass;
  fn( elem, c );
}

var classie = {
  // full names
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass,
  // short names
  has: hasClass,
  add: addClass,
  remove: removeClass,
  toggle: toggleClass
};

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'classie/classie',classie );
} else {
  // browser global
  window.classie = classie;
}

})( window );

/*!
 * EventEmitter v4.2.2 - git.io/ee
 * Oliver Caldwell
 * MIT license
 * @preserve
 */

(function () {
	

	/**
	 * Class for managing events.
	 * Can be extended to provide event functionality in other classes.
	 *
	 * @class EventEmitter Manages event registering and emitting.
	 */
	function EventEmitter() {}

	// Shortcuts to improve speed and size

	// Easy access to the prototype
	var proto = EventEmitter.prototype;

	/**
	 * Finds the index of the listener for the event in it's storage array.
	 *
	 * @param {Function[]} listeners Array of listeners to search through.
	 * @param {Function} listener Method to look for.
	 * @return {Number} Index of the specified listener, -1 if not found
	 * @api private
	 */
	function indexOfListener(listeners, listener) {
		var i = listeners.length;
		while (i--) {
			if (listeners[i].listener === listener) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Alias a method while keeping the context correct, to allow for overwriting of target method.
	 *
	 * @param {String} name The name of the target method.
	 * @return {Function} The aliased method
	 * @api private
	 */
	function alias(name) {
		return function aliasClosure() {
			return this[name].apply(this, arguments);
		};
	}

	/**
	 * Returns the listener array for the specified event.
	 * Will initialise the event object and listener arrays if required.
	 * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
	 * Each property in the object response is an array of listener functions.
	 *
	 * @param {String|RegExp} evt Name of the event to return the listeners from.
	 * @return {Function[]|Object} All listener functions for the event.
	 */
	proto.getListeners = function getListeners(evt) {
		var events = this._getEvents();
		var response;
		var key;

		// Return a concatenated array of all matching events if
		// the selector is a regular expression.
		if (typeof evt === 'object') {
			response = {};
			for (key in events) {
				if (events.hasOwnProperty(key) && evt.test(key)) {
					response[key] = events[key];
				}
			}
		}
		else {
			response = events[evt] || (events[evt] = []);
		}

		return response;
	};

	/**
	 * Takes a list of listener objects and flattens it into a list of listener functions.
	 *
	 * @param {Object[]} listeners Raw listener objects.
	 * @return {Function[]} Just the listener functions.
	 */
	proto.flattenListeners = function flattenListeners(listeners) {
		var flatListeners = [];
		var i;

		for (i = 0; i < listeners.length; i += 1) {
			flatListeners.push(listeners[i].listener);
		}

		return flatListeners;
	};

	/**
	 * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
	 *
	 * @param {String|RegExp} evt Name of the event to return the listeners from.
	 * @return {Object} All listener functions for an event in an object.
	 */
	proto.getListenersAsObject = function getListenersAsObject(evt) {
		var listeners = this.getListeners(evt);
		var response;

		if (listeners instanceof Array) {
			response = {};
			response[evt] = listeners;
		}

		return response || listeners;
	};

	/**
	 * Adds a listener function to the specified event.
	 * The listener will not be added if it is a duplicate.
	 * If the listener returns true then it will be removed after it is called.
	 * If you pass a regular expression as the event name then the listener will be added to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to attach the listener to.
	 * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addListener = function addListener(evt, listener) {
		var listeners = this.getListenersAsObject(evt);
		var listenerIsWrapped = typeof listener === 'object';
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
				listeners[key].push(listenerIsWrapped ? listener : {
					listener: listener,
					once: false
				});
			}
		}

		return this;
	};

	/**
	 * Alias of addListener
	 */
	proto.on = alias('addListener');

	/**
	 * Semi-alias of addListener. It will add a listener that will be
	 * automatically removed after it's first execution.
	 *
	 * @param {String|RegExp} evt Name of the event to attach the listener to.
	 * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addOnceListener = function addOnceListener(evt, listener) {
		return this.addListener(evt, {
			listener: listener,
			once: true
		});
	};

	/**
	 * Alias of addOnceListener.
	 */
	proto.once = alias('addOnceListener');

	/**
	 * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
	 * You need to tell it what event names should be matched by a regex.
	 *
	 * @param {String} evt Name of the event to create.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.defineEvent = function defineEvent(evt) {
		this.getListeners(evt);
		return this;
	};

	/**
	 * Uses defineEvent to define multiple events.
	 *
	 * @param {String[]} evts An array of event names to define.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.defineEvents = function defineEvents(evts) {
		for (var i = 0; i < evts.length; i += 1) {
			this.defineEvent(evts[i]);
		}
		return this;
	};

	/**
	 * Removes a listener function from the specified event.
	 * When passed a regular expression as the event name, it will remove the listener from all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to remove the listener from.
	 * @param {Function} listener Method to remove from the event.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeListener = function removeListener(evt, listener) {
		var listeners = this.getListenersAsObject(evt);
		var index;
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				index = indexOfListener(listeners[key], listener);

				if (index !== -1) {
					listeners[key].splice(index, 1);
				}
			}
		}

		return this;
	};

	/**
	 * Alias of removeListener
	 */
	proto.off = alias('removeListener');

	/**
	 * Adds listeners in bulk using the manipulateListeners method.
	 * If you pass an object as the second argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
	 * You can also pass it a regular expression to add the array of listeners to all events that match it.
	 * Yeah, this function does quite a bit. That's probably a bad thing.
	 *
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to add.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.addListeners = function addListeners(evt, listeners) {
		// Pass through to manipulateListeners
		return this.manipulateListeners(false, evt, listeners);
	};

	/**
	 * Removes listeners in bulk using the manipulateListeners method.
	 * If you pass an object as the second argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	 * You can also pass it an event name and an array of listeners to be removed.
	 * You can also pass it a regular expression to remove the listeners from all events that match it.
	 *
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to remove.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeListeners = function removeListeners(evt, listeners) {
		// Pass through to manipulateListeners
		return this.manipulateListeners(true, evt, listeners);
	};

	/**
	 * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
	 * The first argument will determine if the listeners are removed (true) or added (false).
	 * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
	 * You can also pass it an event name and an array of listeners to be added/removed.
	 * You can also pass it a regular expression to manipulate the listeners of all events that match it.
	 *
	 * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
	 * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
	 * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
		var i;
		var value;
		var single = remove ? this.removeListener : this.addListener;
		var multiple = remove ? this.removeListeners : this.addListeners;

		// If evt is an object then pass each of it's properties to this method
		if (typeof evt === 'object' && !(evt instanceof RegExp)) {
			for (i in evt) {
				if (evt.hasOwnProperty(i) && (value = evt[i])) {
					// Pass the single listener straight through to the singular method
					if (typeof value === 'function') {
						single.call(this, i, value);
					}
					else {
						// Otherwise pass back to the multiple function
						multiple.call(this, i, value);
					}
				}
			}
		}
		else {
			// So evt must be a string
			// And listeners must be an array of listeners
			// Loop over it and pass each one to the multiple method
			i = listeners.length;
			while (i--) {
				single.call(this, evt, listeners[i]);
			}
		}

		return this;
	};

	/**
	 * Removes all listeners from a specified event.
	 * If you do not specify an event then all listeners will be removed.
	 * That means every event will be emptied.
	 * You can also pass a regex to remove all events that match it.
	 *
	 * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.removeEvent = function removeEvent(evt) {
		var type = typeof evt;
		var events = this._getEvents();
		var key;

		// Remove different things depending on the state of evt
		if (type === 'string') {
			// Remove all listeners for the specified event
			delete events[evt];
		}
		else if (type === 'object') {
			// Remove all events matching the regex.
			for (key in events) {
				if (events.hasOwnProperty(key) && evt.test(key)) {
					delete events[key];
				}
			}
		}
		else {
			// Remove all listeners in all events
			delete this._events;
		}

		return this;
	};

	/**
	 * Emits an event of your choice.
	 * When emitted, every listener attached to that event will be executed.
	 * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
	 * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
	 * So they will not arrive within the array on the other side, they will be separate.
	 * You can also pass a regular expression to emit to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	 * @param {Array} [args] Optional array of arguments to be passed to each listener.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.emitEvent = function emitEvent(evt, args) {
		var listeners = this.getListenersAsObject(evt);
		var listener;
		var i;
		var key;
		var response;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				i = listeners[key].length;

				while (i--) {
					// If the listener returns true then it shall be removed from the event
					// The function is executed either with a basic call or an apply if there is an args array
					listener = listeners[key][i];
					response = listener.listener.apply(this, args || []);
					if (response === this._getOnceReturnValue() || listener.once === true) {
						this.removeListener(evt, listener.listener);
					}
				}
			}
		}

		return this;
	};

	/**
	 * Alias of emitEvent
	 */
	proto.trigger = alias('emitEvent');

	/**
	 * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
	 * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
	 *
	 * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
	 * @param {...*} Optional additional arguments to be passed to each listener.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.emit = function emit(evt) {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.emitEvent(evt, args);
	};

	/**
	 * Sets the current value to check against when executing listeners. If a
	 * listeners return value matches the one set here then it will be removed
	 * after execution. This value defaults to true.
	 *
	 * @param {*} value The new value to check for when executing listeners.
	 * @return {Object} Current instance of EventEmitter for chaining.
	 */
	proto.setOnceReturnValue = function setOnceReturnValue(value) {
		this._onceReturnValue = value;
		return this;
	};

	/**
	 * Fetches the current value to check against when executing listeners. If
	 * the listeners return value matches this one then it should be removed
	 * automatically. It will return true by default.
	 *
	 * @return {*|Boolean} The current value to check for or the default, true.
	 * @api private
	 */
	proto._getOnceReturnValue = function _getOnceReturnValue() {
		if (this.hasOwnProperty('_onceReturnValue')) {
			return this._onceReturnValue;
		}
		else {
			return true;
		}
	};

	/**
	 * Fetches the events object and creates one if required.
	 *
	 * @return {Object} The events storage object.
	 * @api private
	 */
	proto._getEvents = function _getEvents() {
		return this._events || (this._events = {});
	};

	// Expose the class either via AMD, CommonJS or the global object
	if (typeof define === 'function' && define.amd) {
		define('eventEmitter/EventEmitter',[],function () {
			return EventEmitter;
		});
	}
	else if (typeof module === 'object' && module.exports){
		module.exports = EventEmitter;
	}
	else {
		this.EventEmitter = EventEmitter;
	}
}.call(this));

/*!
 * eventie v1.0.3
 * event binding helper
 *   eventie.bind( elem, 'click', myFn )
 *   eventie.unbind( elem, 'click', myFn )
 */

/*jshint browser: true, undef: true, unused: true */
/*global define: false */

( function( window ) {



var docElem = document.documentElement;

var bind = function() {};

if ( docElem.addEventListener ) {
  bind = function( obj, type, fn ) {
    obj.addEventListener( type, fn, false );
  };
} else if ( docElem.attachEvent ) {
  bind = function( obj, type, fn ) {
    obj[ type + fn ] = fn.handleEvent ?
      function() {
        var event = window.event;
        // add event.target
        event.target = event.target || event.srcElement;
        fn.handleEvent.call( fn, event );
      } :
      function() {
        var event = window.event;
        // add event.target
        event.target = event.target || event.srcElement;
        fn.call( obj, event );
      };
    obj.attachEvent( "on" + type, obj[ type + fn ] );
  };
}

var unbind = function() {};

if ( docElem.removeEventListener ) {
  unbind = function( obj, type, fn ) {
    obj.removeEventListener( type, fn, false );
  };
} else if ( docElem.detachEvent ) {
  unbind = function( obj, type, fn ) {
    obj.detachEvent( "on" + type, obj[ type + fn ] );
    try {
      delete obj[ type + fn ];
    } catch ( err ) {
      // can't delete window object properties
      obj[ type + fn ] = undefined;
    }
  };
}

var eventie = {
  bind: bind,
  unbind: unbind
};

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'eventie/eventie',eventie );
} else {
  // browser global
  window.eventie = eventie;
}

})( this );

/*!
 * getStyleProperty by kangax
 * http://perfectionkills.com/feature-testing-css-properties/
 */

/*jshint browser: true, strict: true, undef: true */
/*globals define: false */

( function( window ) {



var prefixes = 'Webkit Moz ms Ms O'.split(' ');
var docElemStyle = document.documentElement.style;

function getStyleProperty( propName ) {
  if ( !propName ) {
    return;
  }

  // test standard property first
  if ( typeof docElemStyle[ propName ] === 'string' ) {
    return propName;
  }

  // capitalize
  propName = propName.charAt(0).toUpperCase() + propName.slice(1);

  // test vendor specific properties
  var prefixed;
  for ( var i=0, len = prefixes.length; i < len; i++ ) {
    prefixed = prefixes[i] + propName;
    if ( typeof docElemStyle[ prefixed ] === 'string' ) {
      return prefixed;
    }
  }
}

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'get-style-property/get-style-property',[],function() {
    return getStyleProperty;
  });
} else {
  // browser global
  window.getStyleProperty = getStyleProperty;
}

})( window );

/**
 * getSize v1.1.4
 * measure size of elements
 */

/*jshint browser: true, strict: true, undef: true, unused: true */
/*global define: false */

( function( window, undefined ) {



// -------------------------- helpers -------------------------- //

var defView = document.defaultView;

var getStyle = defView && defView.getComputedStyle ?
  function( elem ) {
    return defView.getComputedStyle( elem, null );
  } :
  function( elem ) {
    return elem.currentStyle;
  };

// get a number from a string, not a percentage
function getStyleSize( value ) {
  var num = parseFloat( value );
  // not a percent like '100%', and a number
  var isValid = value.indexOf('%') === -1 && !isNaN( num );
  return isValid && num;
}

// -------------------------- measurements -------------------------- //

var measurements = [
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'marginBottom',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'borderBottomWidth'
];

function getZeroSize() {
  var size = {
    width: 0,
    height: 0,
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0
  };
  for ( var i=0, len = measurements.length; i < len; i++ ) {
    var measurement = measurements[i];
    size[ measurement ] = 0;
  }
  return size;
}



function defineGetSize( getStyleProperty ) {

// -------------------------- box sizing -------------------------- //

var boxSizingProp = getStyleProperty('boxSizing');
var isBoxSizeOuter;

/**
 * WebKit measures the outer-width on style.width on border-box elems
 * IE & Firefox measures the inner-width
 */
( function() {
  if ( !boxSizingProp ) {
    return;
  }

  var div = document.createElement('div');
  div.style.width = '200px';
  div.style.padding = '1px 2px 3px 4px';
  div.style.borderStyle = 'solid';
  div.style.borderWidth = '1px 2px 3px 4px';
  div.style[ boxSizingProp ] = 'border-box';

  var body = document.body || document.documentElement;
  body.appendChild( div );
  var style = getStyle( div );

  isBoxSizeOuter = getStyleSize( style.width ) === 200;
  body.removeChild( div );
})();


// -------------------------- getSize -------------------------- //

function getSize( elem ) {
  // use querySeletor if elem is string
  if ( typeof elem === 'string' ) {
    elem = document.querySelector( elem );
  }

  // do not proceed on non-objects
  if ( !elem || typeof elem !== 'object' || !elem.nodeType ) {
    return;
  }

  var style = getStyle( elem );

  // if hidden, everything is 0
  if ( style.display === 'none' ) {
    return getZeroSize();
  }

  var size = {};
  size.width = elem.offsetWidth;
  size.height = elem.offsetHeight;

  var isBorderBox = size.isBorderBox = !!( boxSizingProp &&
    style[ boxSizingProp ] && style[ boxSizingProp ] === 'border-box' );

  // get all measurements
  for ( var i=0, len = measurements.length; i < len; i++ ) {
    var measurement = measurements[i];
    var value = style[ measurement ];
    var num = parseFloat( value );
    // any 'auto', 'medium' value will be 0
    size[ measurement ] = !isNaN( num ) ? num : 0;
  }

  var paddingWidth = size.paddingLeft + size.paddingRight;
  var paddingHeight = size.paddingTop + size.paddingBottom;
  var marginWidth = size.marginLeft + size.marginRight;
  var marginHeight = size.marginTop + size.marginBottom;
  var borderWidth = size.borderLeftWidth + size.borderRightWidth;
  var borderHeight = size.borderTopWidth + size.borderBottomWidth;

  var isBorderBoxSizeOuter = isBorderBox && isBoxSizeOuter;

  // overwrite width and height if we can get it from style
  var styleWidth = getStyleSize( style.width );
  if ( styleWidth !== false ) {
    size.width = styleWidth +
      // add padding and border unless it's already including it
      ( isBorderBoxSizeOuter ? 0 : paddingWidth + borderWidth );
  }

  var styleHeight = getStyleSize( style.height );
  if ( styleHeight !== false ) {
    size.height = styleHeight +
      // add padding and border unless it's already including it
      ( isBorderBoxSizeOuter ? 0 : paddingHeight + borderHeight );
  }

  size.innerWidth = size.width - ( paddingWidth + borderWidth );
  size.innerHeight = size.height - ( paddingHeight + borderHeight );

  size.outerWidth = size.width + marginWidth;
  size.outerHeight = size.height + marginHeight;

  return size;
}

return getSize;

}

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'get-size/get-size',[ 'get-style-property/get-style-property' ], defineGetSize );
} else {
  // browser global
  window.getSize = defineGetSize( window.getStyleProperty );
}

})( window );

/*!
 * Draggabilly v1.1.2
 * Make that shiz draggable
 * http://draggabilly.desandro.com
 * MIT license
 */

( function( window ) {



// vars
var document = window.document;

// -------------------------- helpers -------------------------- //

// extend objects
function extend( a, b ) {
  for ( var prop in b ) {
    a[ prop ] = b[ prop ];
  }
  return a;
}

function noop() {}

// ----- get style ----- //

var defView = document.defaultView;

var getStyle = defView && defView.getComputedStyle ?
  function( elem ) {
    return defView.getComputedStyle( elem, null );
  } :
  function( elem ) {
    return elem.currentStyle;
  };


// http://stackoverflow.com/a/384380/182183
var isElement = ( typeof HTMLElement === 'object' ) ?
  function isElementDOM2( obj ) {
    return obj instanceof HTMLElement;
  } :
  function isElementQuirky( obj ) {
    return obj && typeof obj === 'object' &&
      obj.nodeType === 1 && typeof obj.nodeName === 'string';
  };

// -------------------------- requestAnimationFrame -------------------------- //

// https://gist.github.com/1866474

var lastTime = 0;
var prefixes = 'webkit moz ms o'.split(' ');
// get unprefixed rAF and cAF, if present
var requestAnimationFrame = window.requestAnimationFrame;
var cancelAnimationFrame = window.cancelAnimationFrame;
// loop through vendor prefixes and get prefixed rAF and cAF
var prefix;
for( var i = 0; i < prefixes.length; i++ ) {
  if ( requestAnimationFrame && cancelAnimationFrame ) {
    break;
  }
  prefix = prefixes[i];
  requestAnimationFrame = requestAnimationFrame || window[ prefix + 'RequestAnimationFrame' ];
  cancelAnimationFrame  = cancelAnimationFrame  || window[ prefix + 'CancelAnimationFrame' ] ||
                            window[ prefix + 'CancelRequestAnimationFrame' ];
}

// fallback to setTimeout and clearTimeout if either request/cancel is not supported
if ( !requestAnimationFrame || !cancelAnimationFrame )  {
  requestAnimationFrame = function( callback ) {
    var currTime = new Date().getTime();
    var timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
    var id = window.setTimeout( function() {
      callback( currTime + timeToCall );
    }, timeToCall );
    lastTime = currTime + timeToCall;
    return id;
  };

  cancelAnimationFrame = function( id ) {
    window.clearTimeout( id );
  };
}

// -------------------------- definition -------------------------- //

function draggabillyDefinition( classie, EventEmitter, eventie, getStyleProperty, getSize ) {

// -------------------------- support -------------------------- //

var transformProperty = getStyleProperty('transform');
// TODO fix quick & dirty check for 3D support
var is3d = !!getStyleProperty('perspective');

// --------------------------  -------------------------- //

function Draggabilly( element, options ) {
  // querySelector if string
  this.element = typeof element === 'string' ?
    document.querySelector( element ) : element;

  this.options = extend( {}, this.options );
  extend( this.options, options );

  this._create();
}

// inherit EventEmitter methods
extend( Draggabilly.prototype, EventEmitter.prototype );

Draggabilly.prototype.options = {
};

Draggabilly.prototype._create = function() {

  // properties
  this.position = {};
  this._getPosition();

  this.startPoint = { x: 0, y: 0 };
  this.dragPoint = { x: 0, y: 0 };

  this.startPosition = extend( {}, this.position );

  // set relative positioning
  var style = getStyle( this.element );
  if ( style.position !== 'relative' && style.position !== 'absolute' ) {
    this.element.style.position = 'relative';
  }

  this.enable();
  this.setHandles();

};

/**
 * set this.handles and bind start events to 'em
 */
Draggabilly.prototype.setHandles = function() {
  this.handles = this.options.handle ?
    this.element.querySelectorAll( this.options.handle ) : [ this.element ];

  this.bindHandles( true );
};

// -------------------------- bind -------------------------- //

/**
 * @param {Boolean} isBind - will unbind if falsey
 */
Draggabilly.prototype.bindHandles = function( isBind ) {
  var binder;
  if ( window.navigator.pointerEnabled ) {
    binder = this.bindPointer;
  } else if ( window.navigator.msPointerEnabled ) {
    binder = this.bindMSPointer;
  } else {
    binder = this.bindMouseTouch;
  }
  // munge isBind, default to true
  isBind = isBind === undefined ? true : !!isBind;
  for ( var i=0, len = this.handles.length; i < len; i++ ) {
    var handle = this.handles[i];
    binder.call( this, handle, isBind );
  }
};

Draggabilly.prototype.bindPointer = function( handle, isBind ) {
  // W3C Pointer Events, IE11. See https://coderwall.com/p/mfreca
  var bindMethod = isBind ? 'bind' : 'unbind';
  eventie[ bindMethod ]( handle, 'pointerdown', this );
  // disable scrolling on the element
  handle.style.touchAction = isBind ? 'none' : '';
};

Draggabilly.prototype.bindMSPointer = function( handle, isBind ) {
  // IE10 Pointer Events
  var bindMethod = isBind ? 'bind' : 'unbind';
  eventie[ bindMethod ]( handle, 'MSPointerDown', this );
  // disable scrolling on the element
  handle.style.msTouchAction = isBind ? 'none' : '';
};

Draggabilly.prototype.bindMouseTouch = function( handle, isBind ) {
  // listen for both, for devices like Chrome Pixel
  //   which has touch and mouse events
  var bindMethod = isBind ? 'bind' : 'unbind';
  eventie[ bindMethod ]( handle, 'mousedown', this );
  eventie[ bindMethod ]( handle, 'touchstart', this );
  // TODO re-enable img.ondragstart when unbinding
  if ( isBind ) {
    disableImgOndragstart( handle );
  }
};

// remove default dragging interaction on all images in IE8
// IE8 does its own drag thing on images, which messes stuff up

function noDragStart() {
  return false;
}

// TODO replace this with a IE8 test
var isIE8 = 'attachEvent' in document.documentElement;

// IE8 only
var disableImgOndragstart = !isIE8 ? noop : function( handle ) {

  if ( handle.nodeName === 'IMG' ) {
    handle.ondragstart = noDragStart;
  }

  var images = handle.querySelectorAll('img');
  for ( var i=0, len = images.length; i < len; i++ ) {
    var img = images[i];
    img.ondragstart = noDragStart;
  }
};

// -------------------------- position -------------------------- //

// get left/top position from style
Draggabilly.prototype._getPosition = function() {
  // properties
  var style = getStyle( this.element );

  var x = parseInt( style.left, 10 );
  var y = parseInt( style.top, 10 );

  // clean up 'auto' or other non-integer values
  this.position.x = isNaN( x ) ? 0 : x;
  this.position.y = isNaN( y ) ? 0 : y;

  this._addTransformPosition( style );
};

// add transform: translate( x, y ) to position
Draggabilly.prototype._addTransformPosition = function( style ) {
  if ( !transformProperty ) {
    return;
  }
  var transform = style[ transformProperty ];
  // bail out if value is 'none'
  if ( transform.indexOf('matrix') !== 0 ) {
    return;
  }
  // split matrix(1, 0, 0, 1, x, y)
  var matrixValues = transform.split(',');
  // translate X value is in 12th or 4th position
  var xIndex = transform.indexOf('matrix3d') === 0 ? 12 : 4;
  var translateX = parseInt( matrixValues[ xIndex ], 10 );
  // translate Y value is in 13th or 5th position
  var translateY = parseInt( matrixValues[ xIndex + 1 ], 10 );
  this.position.x += translateX;
  this.position.y += translateY;
};

// -------------------------- events -------------------------- //

// trigger handler methods for events
Draggabilly.prototype.handleEvent = function( event ) {
  var method = 'on' + event.type;
  if ( this[ method ] ) {
    this[ method ]( event );
  }
};

// returns the touch that we're keeping track of
Draggabilly.prototype.getTouch = function( touches ) {
  for ( var i=0, len = touches.length; i < len; i++ ) {
    var touch = touches[i];
    if ( touch.identifier === this.pointerIdentifier ) {
      return touch;
    }
  }
};

// ----- start event ----- //

Draggabilly.prototype.onmousedown = function( event ) {
  // dismiss clicks from right or middle buttons
  var button = event.button;
  if ( button && ( button !== 0 && button !== 1 ) ) {
    return;
  }
  this.dragStart( event, event );
};

Draggabilly.prototype.ontouchstart = function( event ) {
  // disregard additional touches
  if ( this.isDragging ) {
    return;
  }

  this.dragStart( event, event.changedTouches[0] );
};

Draggabilly.prototype.onMSPointerDown =
Draggabilly.prototype.onpointerdown = function( event ) {
  // disregard additional touches
  if ( this.isDragging ) {
    return;
  }

  this.dragStart( event, event );
};

function setPointerPoint( point, pointer ) {
  point.x = pointer.pageX !== undefined ? pointer.pageX : pointer.clientX;
  point.y = pointer.pageY !== undefined ? pointer.pageY : pointer.clientY;
}

// hash of events to be bound after start event
var postStartEvents = {
  mousedown: [ 'mousemove', 'mouseup' ],
  touchstart: [ 'touchmove', 'touchend', 'touchcancel' ],
  pointerdown: [ 'pointermove', 'pointerup', 'pointercancel' ],
  MSPointerDown: [ 'MSPointerMove', 'MSPointerUp', 'MSPointerCancel' ]
};

/**
 * drag start
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragStart = function( event, pointer ) {
  if ( !this.isEnabled ) {
    return;
  }

  if ( event.preventDefault ) {
    event.preventDefault();
  } else {
    event.returnValue = false;
  }

  // save pointer identifier to match up touch events
  this.pointerIdentifier = pointer.pointerId !== undefined ?
    // pointerId for pointer events, touch.indentifier for touch events
    pointer.pointerId : pointer.identifier;

  this._getPosition();

  this.measureContainment();

  // point where drag began
  setPointerPoint( this.startPoint, pointer );
  // position _when_ drag began
  this.startPosition.x = this.position.x;
  this.startPosition.y = this.position.y;

  // reset left/top style
  this.setLeftTop();

  this.dragPoint.x = 0;
  this.dragPoint.y = 0;

  // bind move and end events
  this._bindEvents({
    // get proper events to match start event
    events: postStartEvents[ event.type ],
    // IE8 needs to be bound to document
    node: event.preventDefault ? window : document
  });

  classie.add( this.element, 'is-dragging' );

  // reset isDragging flag
  this.isDragging = true;

  this.emitEvent( 'dragStart', [ this, event, pointer ] );

  // start animation
  this.animate();
};

Draggabilly.prototype._bindEvents = function( args ) {
  for ( var i=0, len = args.events.length; i < len; i++ ) {
    var event = args.events[i];
    eventie.bind( args.node, event, this );
  }
  // save these arguments
  this._boundEvents = args;
};

Draggabilly.prototype._unbindEvents = function() {
  var args = this._boundEvents;
  // IE8 can trigger dragEnd twice, check for _boundEvents
  if ( !args || !args.events ) {
    return;
  }

  for ( var i=0, len = args.events.length; i < len; i++ ) {
    var event = args.events[i];
    eventie.unbind( args.node, event, this );
  }
  delete this._boundEvents;
};

Draggabilly.prototype.measureContainment = function() {
  var containment = this.options.containment;
  if ( !containment ) {
    return;
  }

  this.size = getSize( this.element );
  var elemRect = this.element.getBoundingClientRect();

  // use element if element
  var container = isElement( containment ) ? containment :
    // fallback to querySelector if string
    typeof containment === 'string' ? document.querySelector( containment ) :
    // otherwise just `true`, use the parent
    this.element.parentNode;

  this.containerSize = getSize( container );
  var containerRect = container.getBoundingClientRect();

  this.relativeStartPosition = {
    x: elemRect.left - containerRect.left,
    y: elemRect.top  - containerRect.top
  };
};

// ----- move event ----- //

Draggabilly.prototype.onmousemove = function( event ) {
  this.dragMove( event, event );
};

Draggabilly.prototype.onMSPointerMove =
Draggabilly.prototype.onpointermove = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragMove( event, event );
  }
};

Draggabilly.prototype.ontouchmove = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  if ( touch ) {
    this.dragMove( event, touch );
  }
};

/**
 * drag move
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragMove = function( event, pointer ) {

  setPointerPoint( this.dragPoint, pointer );
  var dragX = this.dragPoint.x - this.startPoint.x;
  var dragY = this.dragPoint.y - this.startPoint.y;

  var grid = this.options.grid;
  var gridX = grid && grid[0];
  var gridY = grid && grid[1];

  dragX = applyGrid( dragX, gridX );
  dragY = applyGrid( dragY, gridY );

  dragX = this.containDrag( 'x', dragX, gridX );
  dragY = this.containDrag( 'y', dragY, gridY );

  // constrain to axis
  dragX = this.options.axis === 'y' ? 0 : dragX;
  dragY = this.options.axis === 'x' ? 0 : dragY;

  this.position.x = this.startPosition.x + dragX;
  this.position.y = this.startPosition.y + dragY;
  // set dragPoint properties
  this.dragPoint.x = dragX;
  this.dragPoint.y = dragY;

  this.emitEvent( 'dragMove', [ this, event, pointer ] );
};

function applyGrid( value, grid, method ) {
  method = method || 'round';
  return grid ? Math[ method ]( value / grid ) * grid : value;
}

Draggabilly.prototype.containDrag = function( axis, drag, grid ) {
  if ( !this.options.containment ) {
    return drag;
  }
  var measure = axis === 'x' ? 'width' : 'height';

  var rel = this.relativeStartPosition[ axis ];
  var min = applyGrid( -rel, grid, 'ceil' );
  var max = this.containerSize[ measure ] - rel - this.size[ measure ];
  max = applyGrid( max, grid, 'floor' );
  return  Math.min( max, Math.max( min, drag ) );
};

// ----- end event ----- //

Draggabilly.prototype.onmouseup = function( event ) {
  this.dragEnd( event, event );
};

Draggabilly.prototype.onMSPointerUp =
Draggabilly.prototype.onpointerup = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragEnd( event, event );
  }
};

Draggabilly.prototype.ontouchend = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  if ( touch ) {
    this.dragEnd( event, touch );
  }
};

/**
 * drag end
 * @param {Event} event
 * @param {Event or Touch} pointer
 */
Draggabilly.prototype.dragEnd = function( event, pointer ) {
  this.isDragging = false;

  delete this.pointerIdentifier;

  // use top left position when complete
  if ( transformProperty ) {
    this.element.style[ transformProperty ] = '';
    this.setLeftTop();
  }

  // remove events
  this._unbindEvents();

  classie.remove( this.element, 'is-dragging' );

  this.emitEvent( 'dragEnd', [ this, event, pointer ] );

};

// ----- cancel event ----- //

// coerce to end event

Draggabilly.prototype.onMSPointerCancel =
Draggabilly.prototype.onpointercancel = function( event ) {
  if ( event.pointerId === this.pointerIdentifier ) {
    this.dragEnd( event, event );
  }
};

Draggabilly.prototype.ontouchcancel = function( event ) {
  var touch = this.getTouch( event.changedTouches );
  this.dragEnd( event, touch );
};

// -------------------------- animation -------------------------- //

Draggabilly.prototype.animate = function() {
  // only render and animate if dragging
  if ( !this.isDragging ) {
    return;
  }

  this.positionDrag();

  var _this = this;
  requestAnimationFrame( function animateFrame() {
    _this.animate();
  });

};

// transform translate function
var translate = is3d ?
  function( x, y ) {
    return 'translate3d( ' + x + 'px, ' + y + 'px, 0)';
  } :
  function( x, y ) {
    return 'translate( ' + x + 'px, ' + y + 'px)';
  };

// left/top positioning
Draggabilly.prototype.setLeftTop = function() {
  this.element.style.left = this.position.x + 'px';
  this.element.style.top  = this.position.y + 'px';
};

Draggabilly.prototype.positionDrag = transformProperty ?
  function() {
    // position with transform
    this.element.style[ transformProperty ] = translate( this.dragPoint.x, this.dragPoint.y );
  } : Draggabilly.prototype.setLeftTop;

// -----  ----- //

Draggabilly.prototype.enable = function() {
  this.isEnabled = true;
};

Draggabilly.prototype.disable = function() {
  this.isEnabled = false;
  if ( this.isDragging ) {
    this.dragEnd();
  }
};

Draggabilly.prototype.destroy = function() {
  this.disable();
  // reset styles
  if ( transformProperty ) {
    this.element.style[ transformProperty ] = '';
  }
  this.element.style.left = '';
  this.element.style.top = '';
  this.element.style.position = '';
  // unbind handles
  this.bindHandles( false );
};

// -----  ----- //

return Draggabilly;

} // end definition

// -------------------------- transport -------------------------- //

if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( 'components/adapt-ppq/js/draggabilly',[
      'classie/classie',
      'eventEmitter/EventEmitter',
      'eventie/eventie',
      'get-style-property/get-style-property',
      'get-size/get-size'
    ],
    draggabillyDefinition );
} else if ( typeof exports === 'object' ) {
  // CommonJS
  module.exports = draggabillyDefinition(
    require('desandro-classie'),
    require('wolfy87-eventemitter'),
    require('eventie'),
    require('desandro-get-style-property'),
    require('get-size')
  );
} else {
  // browser global
  window.Draggabilly = draggabillyDefinition(
    window.classie,
    window.EventEmitter,
    window.eventie,
    window.getStyleProperty,
    window.getSize
  );
}

})( window );


define('components/adapt-ppq/js/adapt-ppq',['require','coreViews/questionView','coreJS/adapt','components/adapt-ppq/js/draggabilly'],function(require) {

	var QuestionView = require('coreViews/questionView');
	var Adapt = require('coreJS/adapt');
    var Draggabilly = require('components/adapt-ppq/js/draggabilly');

    var PPQ = QuestionView.extend({

        componentDimensions: {
            height: 0,
            width: 0
        },

        events: {
            "click .ppq-pinboard":"placePin",
            "click .ppq-icon": "preventDefault"
        },

        preventDefault: function(event) {
            event.preventDefault();
        },

        preRender:function(){
            QuestionView.prototype.preRender.apply(this);
            if (this.model.get("_selectable")) {
                var selectors = [];
                for (var i = 0, l = parseInt(this.model.get("_selectable")); i < l; i++) {
                    selectors.push(i)
                }
                this.model.set("_selectors", selectors);
            }
            this.setLayout();
            this.listenTo(Adapt, 'device:changed', this.handleDeviceChanged);
            this.listenTo(Adapt, 'device:resize', this.handleDeviceResize);
        },

        postRender: function() {
            QuestionView.prototype.postRender.apply(this);

            var thisHandle = this;
            //Wait for pinboard image to load then set ready. If already complete show completed state.
            this.$('.ppq-pinboard-container-inner').imageready(_.bind(function() {

                var $pins = this.$el.find('.ppq-pin');
                $pins.each(function(index, item) {
                    item.dragObj = new Draggabilly(item, {
                        containment: true
                    });
                    if (thisHandle.model.get("_isSubmitted")) {
                        item.dragObj.disable();
                    } else {
                        item.dragObj.on('dragStart', _.bind(thisHandle.onDragStart, thisHandle));
                        item.dragObj.on('dragEnd',  _.bind(thisHandle.onDragEnd, thisHandle));
                    }
                });

                _.extend(this.componentDimensions, {
                    height: this.$("#ppq-boundary").height(),
                    width: this.$("#ppq-boundary").width()
                });

                this.setReadyStatus();
                if (this.model.get("_isComplete") && this.model.get("_isInteractionsComplete")) {
                    this.showCompletedState();
                }
            }, this));
        },

        updateButtons: function() {
            QuestionView.prototype.updateButtons.apply(this);

            if (this.model.get("_isSubmitted")) {
                 var $pins = this.$el.find('.ppq-pin');
                $pins.each(function(index, item) {
                    item.dragObj.disable();
                });
                this.model.set("_countCorrect",this.$(".item-correct").length);
            }

            //this.model.get('_buttonState') == 'submit' ? this.$('.ppq-reset-pins').show() : this.$('.ppq-reset-pins').hide();
        },

        showCompletedState: function() {

            //show the user answer then apply classes to set the view to a completed state
            this.hideCorrectAnswer();
            this.$(".ppq-pin").addClass("in-use");
            this.$(".ppq-widget").addClass("submitted disabled show-user-answer");
            if (this.model.get("_isCorrect")) {
                this.$(".ppq-widget").addClass("correct");
            }
        },

        handleDeviceChanged: function() {

            var componentDimensions = {
                height: this.$("#ppq-boundary").height(),
                width: this.$("#ppq-boundary").width()
            };
            if (this.componentDimensions.height == componentDimensions.height && this.componentDimensions.width == componentDimensions.width) {
                this.componentDimensions = componentDimensions;
                return;
            }

            this.$el.css("display:block");
            
            //Currently causes layout to change from desktop to mobile even if completed.
            this.setLayout();

            var props, isDesktop = this.model.get('desktopLayout');

            _.each(this.model.get('_items'), function(item, index) {
                props = isDesktop ? item.desktop : item.mobile;
                this.$('.ppq-correct-zone').eq(index).css({left:props.left+'%', top:props.top+'%', width:props.width+'%', height:props.height+'%'});
            }, this);

            props = isDesktop ? this.model.get('_pinboardDesktop') : this.model.get('_pinboardMobile');

            this.$('.ppq-pinboard').attr({src:props.src, title:props.title, alt:props.alt});

            this.handleDeviceResize();

            if (this.model.get("_isComplete")) {
                var width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10);

                var $pins = this.$(".ppq-pin");
                var countCorrect = this.model.get("_countCorrect");
                var currentLayoutItems = this.getItemsForCurrentLayout(this.model.get("_items"));

                var moved = 0;
                var uas = this.model.get("_userAnswer");
                _.each(currentLayoutItems, _.bind(function(item) {
                    var $pin = $($pins[moved]);
                    var top = 0;
                    var left = 0;
                    var uaObj;
                    if (moved < countCorrect) {
                        top = ((height/ 100) * (item.top + (item.height/2))) - ($pin.height() / 1.05);
                        left = ((width / 100) * (item.left + (item.width / 2))) - ($pin.width() / 1.05);
                        $pin.css({
                            top: top + 'px',
                            left: left + 'px'
                        });

                    } else {
                        
                        var inpos = true;
                        while(inpos == true) {
                            inpos = false;
                            top = (Math.random() * 80) + 10;
                            left = (Math.random() * 80) + 10;
                            top = ((height/ 100) * top) - ($pin.height() / 1.05);
                            left = ((width/ 100) * left) - ($pin.width() / 1.05);

                            var atop = top - ($pin.height());
                            var aleft = left - ($pin.width() /2);

                            $pin.css({
                                top: top + 'px',
                                left: left + 'px'
                            });

                            inpos = this.isInCorrectZone($pin, undefined, currentLayoutItems);
                        }

                    }

                    uaObj = {
                            top: (100/height) * top,
                            left: (100/width) * left
                        };
                    uas[moved] = uaObj;

                    moved++;
                }, this))
                this.model.set("_userAnswer", uas);
            }

            this.handleDeviceResize();
        },

        handleDeviceResize: function() {

            var componentDimensions = {
                height: this.$("#ppq-boundary").height(),
                width: this.$("#ppq-boundary").width()
            };
            if (this.componentDimensions.height == componentDimensions.height && this.componentDimensions.width == componentDimensions.width) {
                this.componentDimensions = componentDimensions;
                return;
            }


            this.$el.css("display:block");
            // Calls resetPins then if complete adds back classes that are required to show the completed state.
            this.resetPins();
            if (this.model.get("_isComplete")) {
                this.$(".ppq-pin").addClass("in-use");
                if (this.$(".ppq-widget").hasClass("show-user-answer")) {
                    this.hideCorrectAnswer();
                } else {
                    this.showCorrectAnswer();
                }
            }
        },

        setLayout: function() {

            //Setlayout for view. This is also called when device changes.
            console.log(Adapt.device.screenSize);
            if (Adapt.device.screenSize == "large") {
                this.model.set({
                    desktopLayout:true
                });
            } else if (Adapt.device.screenSize == "medium" || Adapt.device.screenSize == "small") {
                this.model.set({
                    desktopLayout:false
                });
            }
            
        },

        placePin: function(event) {

            event.preventDefault();

            //Handles click event on the pinboard image to place pins
            var $pin = this.$('.ppq-pin:not(.in-use):first');
            if ($pin.length === 0) return;

            var offset = this.$('.ppq-pinboard').offset();

            var clickY = ( event.clientY < offset.top ? event.pageY : event.clientY );
            var clickX = ( event.clientX < offset.left ? event.pageX : event.clientX );

            var relX = (clickX - offset.left) - ($pin.width() / 2);
            var relY = ((clickY - offset.top)) - $pin.height();

            $pin.css({
                top:relY + 'px',
                left:relX + 'px'
            }).addClass('in-use');
            $pin.addClass('in-use');

            var isDuplicate = this.isDuplicatePin($pin);
            if (isDuplicate) {
                $pin.removeClass('in-use');
                $pin.css({
                    top: "initial",
                    left: "initial"
                });
            }
        },

        resetQuestion: function() {
            this.resetPins();
            this.model.set({
                _isAtLeastOneCorrectSelection: false
            });

            var $pins = this.$el.find('.ppq-pin');
            $pins.each(function(index, item) {
                if (item.dragObj) item.dragObj.enable();
            });
        },

        resetPins: function(event) {

            //the class "in-use" is what makes the pins visible
            if (event) event.preventDefault();
            this.$(".ppq-pin").removeClass("in-use item-correct item-incorrect");
        },

        canSubmit: function() {
            if (this.model.get("_selectable")) {
                if(this.$(".ppq-pin.in-use").length == this.model.get("_selectors").length) {
                    return true;
                } else {
                    return false;
                }
            } else {
                if(this.$(".ppq-pin.in-use").length == this.model.get("_items").length) {
                    return true;
                } else {
                    return false;
                }
            }
        },

        storeUserAnswer:function()
        {
            var pins = this.$(".ppq-pin");

            // User answers aren't stored in the items array. Instead we create a new array with userAnswer objects.
            var userAnswers = [];

            _.each(pins, function(pin) {
               // userAnswer stores the return value from getUserAnswer and adds that to the userAnswers array.
               var userAnswer = this.getUserAnswer($(pin));
               userAnswers.push(userAnswer);
            }, this);

            this.model.set('_userAnswer', userAnswers);
        },

        isCorrect: function() {
            var correctCount = 0;
            var pins = this.$(".ppq-pin");

            // There are both desktop and mobile items but nested in the same items object.
            // So we need to store the currentLayoutItems locally to check answers against the current layout.
            var currentLayoutItems = this.getItemsForCurrentLayout(this.model.get("_items"));

            // Loop through the currentLayoutItems and check each answer
            _.each(currentLayoutItems, function(item, index) {
                _.each(pins, function(pin, pIndex) {
                    var $pin = $(pin);
                    var isCorrect = this.isInCorrectZone($pin, item);
                    if (isCorrect) {
                        item._isPlacementCorrect = true;
                        correctCount++;
                        this.model.set('_isAtLeastOneCorrectSelection', true);
                   } else {
                        item._isPlacementCorrect = false;
                   }
                }, this);
            }, this);

            if (this.model.get("_selectable")) {
                return correctCount == this.model.get("_selectors").length;
            } else {
                return correctCount == currentLayoutItems.length;
            }
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        getItemsForCurrentLayout: function(items) {

            // Returns an array of items based on current layout
            var currentLayoutItems = [];
            _.each(items, function(item) {
                var newItem;
                if (this.model.get("desktopLayout")) {
                    newItem = item.desktop;
                } else {
                    newItem = item.mobile;
                }
                newItem._isCorrect = item._isCorrect;
                currentLayoutItems.push(newItem);
            }, this);
            return currentLayoutItems;
        },

        isInCorrectZone: function($pin, item, items){

            var width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10),
                pinLeft = parseFloat($pin.css("left")) + (parseFloat($pin.css("width")) / 2),
                pinTop = parseFloat($pin.css("top")) + parseFloat($pin.css("height")),
                inCorrectZone = false;
            var pinId = $pin.attr("data-id");

            if(item) {
                var top = (item.top/100)*height,
                    left = (item.left/100)*width,
                    bottom = top + (item.height/100)*height,
                    right = left + (item.width/100)*width;
                inCorrectZone = pinLeft > left && pinLeft < right && pinTop < bottom && pinTop > top;
                inCorrectZone = inCorrectZone  && item._isCorrect !== false;
                return inCorrectZone;
            } else {
                for (var i = 0; i < items.length; i++) {
                    var item = items[i],
                        top = (item.top/100)*height,
                        left = (item.left/100)*width,
                        bottom = top + (item.height/100)*height,
                        right = left + (item.width/100)*width;
                    inCorrectZone = pinLeft > left && pinLeft < right && pinTop < bottom && pinTop > top;
                    inCorrectZone = inCorrectZone  && item._isCorrect !== false;
                    if(inCorrectZone) break;
                }
                return inCorrectZone;
            }
        },

        getPinZone: function($pin, items){

            var width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10),
                pinLeft = parseFloat($pin.css("left")) + (parseFloat($pin.css("width")) / 2),
                pinTop = parseFloat($pin.css("top")) + parseFloat($pin.css("height")),
                inCorrectZone = false;
            var pinId = $pin.attr("data-id");

            for (var i = 0; i < items.length; i++) {
                var item = items[i],
                    top = (item.top/100)*height,
                    left = (item.left/100)*width,
                    bottom = top + (item.height/100)*height,
                    right = left + (item.width/100)*width;
                inCorrectZone = pinLeft > left && pinLeft < right && pinTop < bottom && pinTop > top;
                if(inCorrectZone) return i;
            }
            return -1;
        },

        getUserAnswer: function($pin) {

            // Returns a user answer object that gets added to a userAnswers array
            var left = parseFloat($pin.css("left")),
                top = parseFloat($pin.css("top")),
                width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10);
            return {
                left: (100/width) * left,
                top: (100/height) * top
            }
        },

        showMarking:function()
        {
            this.hideCorrectAnswer();
        },

        hideCorrectAnswer: function() {
            var width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10);
            var pins = this.$(".ppq-pin");
            var userAnswers = this.model.get("_userAnswer");
            var currentLayoutItems = this.getItemsForCurrentLayout(this.model.get("_items"));

            _.each(userAnswers, function(userAnswer, index) {
                var $pin = $(pins[index])
                $pin.css({
                    top:(height/100) * userAnswer.top + "px",
                    left:(width/100) *userAnswer.left + "px"
                });

                // Reset classes then apply correct incorrect
                $pin.removeClass("item-correct item-incorrect");
                if (this.isInCorrectZone($pin, null, currentLayoutItems)) {
                    $pin.addClass("item-correct");
                } else {
                    $pin.addClass("item-incorrect");
                }
            }, this);
        },

        showCorrectAnswer: function() {
            var width = parseInt(this.$('.ppq-pinboard').width(),10),
                height = parseInt(this.$('.ppq-pinboard').height(),10);
            var pins = this.$(".ppq-pin"),
                answers = this.getItemsForCurrentLayout(this.model.get("_items"));
            _.each(answers, function(item, index) {
                var $pin = $(pins[index]);
                $pin.css({
                    top: ((height/ 100) * (item.top + (item.height/2))) - ($pin.height() / 2 ) + 'px',
                    left: ((width / 100) * (item.left + (item.width / 2))) - ($pin.width() / 2) + 'px'
                });
                $pin.removeClass("item-incorrect").addClass("item-correct");
            });
        },

        onDragStart: function(event) {
            console.log("Drag Start");
            var $pin = $(event.element);
            var pos = {
                top: $pin.css("top"),
                left: $pin.css("left")
            };
            $pin.attr("data-prev", JSON.stringify(pos));
        },

        onDragEnd: function(event) {
            console.log("Drag End");

            var $pin = $(event.element);

            var isDuplicate = this.isDuplicatePin($pin);
            if (isDuplicate) {
                console.log("Duplicate!")
                var pos = JSON.parse($pin.attr("data-prev"));
                $pin.css(pos);
            }
        },

        isDuplicatePin: function($pin) {
            var pins = this.$(".ppq-pin");
            var currentLayoutItems = this.getItemsForCurrentLayout(this.model.get("_items"));

            var pinZone = this.getPinZone($pin, currentLayoutItems);
            var pinDataId = $pin.attr("data-id");

            var populatedZones = {};
            for (var i = 0, l = pins.length; i < l; i++) {
                var $curPin = $(pins[i]);
                var curPinDataId = $curPin.attr("data-id");
                //if (curPinDataId === pinDataId ) continue;
                var zone = this.getPinZone($curPin, currentLayoutItems);
                if (populatedZones[zone] === undefined) populatedZones[zone] = [];
                populatedZones[zone].push(curPinDataId);
            }

            if (populatedZones[pinZone].length > 1 && pinZone > -1) return true;
            return false;
            
        }

    });

    Adapt.register("ppq", PPQ);

    return PPQ;

});

define('components/adapt-questionStrip/js/adapt-questionStrip',[ "coreJS/adapt", "coreViews/questionView" ], function(Adapt, QuestionView) {

    var QuestionStrip = QuestionView.extend({

        events: function() {
            return _.extend({}, QuestionView.prototype.events, {
                'click .qs-controls':'onNavigationClicked'
            });
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        // Used by question to disable the question during submit and complete stages
        disableQuestion: function() {
            this.$('.qs-controls').addClass('disabled');
        },

        // Used by question to enable the question during interactions
        enableQuestion: function() {
            this.$('.qs-controls').removeClass('disabled');
        },

        // Used by the question to reset the question when revisiting the component
        resetQuestionOnRevisit: function() {
            this.resetQuestion();
        },

        setupQuestion: function() {
            this.listenTo(Adapt, 'device:resize', this.resizeControl, this);
            this.setDeviceSize();
            this.restoreUserAnswers();
        },

        restoreUserAnswers: function() {
            if (!this.model.get("_isSubmitted")) return;

            var userAnswer = this.model.get("_userAnswer");

            _.each(this.model.get("_items"), function(item, index) {
                item._stage = userAnswer[index];
            });

            this.setQuestionAsSubmitted();
            this.markQuestion();
            this.setScore();
            this.showMarking();
            this.setupFeedback();
        },

        storeUserAnswer: function() {

            var userAnswer = new Array(this.model.get('_items').length);

            _.each(this.model.get('_items'), function(item, index) {
                userAnswer[index] = item._stage;
            }, this);
            
            this.model.set('_userAnswer', userAnswer);

        },

        onQuestionRendered: function() {
            this.setupImages();
            this.setupNarrative();
        },

        canSubmit: function() {
            return true;
        },

        isCorrect: function() {

            var numberOfCorrectAnswers = 0;

            _.each(this.model.get('_items'), function(item, index) {

                if (item.hasOwnProperty('_stage') && item._subItems[item._stage]._isCorrect) {
                    numberOfCorrectAnswers ++;
                    item._isCorrect = true;
                    this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);
                    this.model.set('_isAtLeastOneCorrectSelection', true);
                } else {
                    item._isCorrect = false;
                }

            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);

            if (numberOfCorrectAnswers === this.model.get('_items').length) {
                return true;
            } else {
                return false;
            }

        },

        setScore: function() {
            var questionWeight = this.model.get("_questionWeight");

            if (this.model.get('_isCorrect')) {
                this.model.set('_score', questionWeight);
                return;
            }
            
            var numberOfCorrectAnswers = this.model.get('_numberOfCorrectAnswers');
            var itemLength = this.model.get('_items').length;

            var score = questionWeight * numberOfCorrectAnswers / itemLength;

            this.model.set('_score', score);
        },

        showMarking: function() {

            _.each(this.model.get('_items'), function(item, i) {

                var $item = this.$('.component-item').eq(i);
                $item.removeClass('correct incorrect').addClass(item._isCorrect ? 'correct' : 'incorrect');

            }, this);

        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            this.model.set({_userAnswer: []});
        },

        resetQuestion: function() {
            this.$(".component-item").removeClass("correct").removeClass("incorrect");
            this.model.set('_isAtLeastOneCorrectSelection', false);
            _.each(this.model.get("_items"), function(item, index) {
                this.setStage(index, item.hasOwnProperty('_initialItemIndex') ? item._initialItemIndex : 0);
            }, this);
        },

        showCorrectAnswer: function() {

            _.each(this.model.get('_items'), function(item, index) {

                _.each(item._subItems, function(option, optionIndex) {
                    if (option._isCorrect) {
                        this.setStage(index, optionIndex);
                    }
                }, this);

            }, this);

        },

        hideCorrectAnswer: function() {
            
            _.each(this.model.get('_items'), function(item, index) {
                this.setStage(index, this.model.get('_userAnswer')[index]);
            }, this);
        },

        setupImages: function() {
            var _items = this.model.get("_items");
            var _images = this.model.get("_images");

            var splitHeight = _items.length;
            var images = _images.length;
            var imagesSplit = 0;

            var thisHandle = this;

            var height = undefined;
            var width = undefined;
            
            var imagesToLoadCount = 0;
            var imagesLoadedCount = 0;

            _.each(_images, function(image) {
                var imageObj = new Image();
                $(imageObj).bind("load", function(event) {
                    imagesSplit++;

                    var imgHeight = imageObj.naturalHeight;
                    var imgWidth = imageObj.naturalWidth;

                    height = height || imageObj.naturalHeight;
                    width = width || imageObj.naturalWidth;

                    var finalHeight = height / splitHeight;

                    var offsetTop = 0;
                    var offsetLeft = 0;
                    var newHeight = height;

                    if (imgWidth != width) newHeight = (width/imgWidth) * imgHeight;

                    var canvas = document.createElement("canvas");
                    if (typeof G_vmlCanvasManager != 'undefined') G_vmlCanvasManager.initElement(canvas);
                    canvas.width = width; 
                    canvas.style.width = "100%"; 
                    canvas.height = finalHeight; 

                    var ctx = canvas.getContext("2d");

                    for (var s = 0; s < splitHeight; s++) {
                        ctx.drawImage(imageObj, 0, 0, imgWidth, imgHeight, 0 + offsetLeft, -(s * finalHeight) + offsetTop, width, newHeight);
                        var imageURL = canvas.toDataURL();

                        var img = document.createElement("img");
                        thisHandle.$('.item-'+s+'.qs-slide-container .i'+image._id).append(img);
                        imagesToLoadCount++;
                        $(img).bind("load", function() {
                            imagesLoadedCount++;

                            if (imagesToLoadCount == imagesLoadedCount) {
                                thisHandle.setReadyStatus();
                                $(window).resize();
                            }
                        });
                        img.src = imageURL;

                    }

                    if (imagesSplit == images) {
                        thisHandle.calculateWidths();
                    }

                });
                imageObj.src = image.src;
            });
        },

        setupNarrative: function() {
            this.setDeviceSize();
            
            var _items = this.model.get("_items");
            var thisHandle = this;
            _.each(_items, function(item, index) {
                item._itemCount = item._subItems.length;
                if (item.hasOwnProperty('_stage')) {
                    thisHandle.setStage(index, item._stage, true);
                } else {
                    thisHandle.setStage(index, item.hasOwnProperty('_initialItemIndex') ? item._initialItemIndex : 0);
                }
            });
            
            this.model.set('_active', true);

        },

        calculateWidths: function() {
            //calc widths for each item
            var _items = this.model.get("_items");
            _.each(_items, function(item, index) {
                var slideWidth = this.$('.qs-slide-container').width();
                var slideCount = item._itemCount;
                var marginRight = this.$('.qs-slider-graphic').css('margin-right');

                var extraMargin = marginRight === "" ? 0 : parseInt(marginRight);
                var fullSlideWidth = (slideWidth + extraMargin) * slideCount;
                var iconWidth = this.$('.qs-popup-open').outerWidth();
                var $headerInner = this.$(".item-" + index)
                    .find(".qs-strapline-header-inner");

                this.$('.item-'+index+'.qs-slide-container .qs-slider-graphic').width(slideWidth)
                this.$('.qs-strapline-header').width(slideWidth);
                this.$('.qs-strapline-title').width(slideWidth);

                this.$('.item-'+index+'.qs-slide-container .qs-slider').width(fullSlideWidth);
                $headerInner.width(fullSlideWidth);

                var stage = item._stage;//this.model.get('_stage');
                var margin = -(stage * slideWidth);

                this.$('.item-'+index+'.qs-slide-container .qs-slider').css('margin-left', margin);
                $headerInner.css("margin-left", margin);

                item._finalItemLeft = fullSlideWidth - slideWidth;
            });

            _.each(this.$('.qs-slider-graphic'), function(item) {
                $(item).attr("height","").css("height","");
            });
        },

        resizeControl: function() {
            this.setDeviceSize();
            this.calculateWidths();
            var _items = this.model.get("_items");
            var thisHandle = this;
            _.each(_items, function(item, index) {
                thisHandle.evaluateNavigation(index);
            });
        },

        moveSliderToIndex: function(itemIndex, stage, animate) {
            var extraMargin = parseInt(this.$('.item-'+itemIndex+'.qs-slide-container .qs-slider-graphic').css('margin-right')),
                movementSize = this.$('.item-'+itemIndex+'.qs-slide-container').width()+extraMargin;

            if(animate) {
                this.$('.item-'+itemIndex+'.qs-slide-container .qs-slider').stop().animate({'margin-left': -(movementSize * stage)});
                this.$('.item-'+itemIndex+' .qs-strapline-header .qs-strapline-header-inner').stop(true, true).animate({'margin-left': -(movementSize * stage)});
            } else {
                this.$('.item-'+itemIndex+'.qs-slide-container .qs-slider').css({'margin-left': -(movementSize * stage)});
                this.$('.item-'+itemIndex+' .qs-strapline-header .qs-strapline-header-inner').css({'margin-left': -(movementSize * stage)});
            }
        },

        setStage: function(itemIndex, stage, initial) {
            var item = this.model.get('_items')[itemIndex];
            item._stage = stage;
            item.visited = true;

            this.$('.qs-progress').removeClass('selected').eq(stage).addClass('selected');
            this.$('.item-'+itemIndex+'.qs-slide-container .qs-slider-graphic').children('.controls').attr('tabindex', -1);
            this.$('.item-'+itemIndex+'.qs-slide-container .qs-slider-graphic').eq(stage).children('.controls').attr('tabindex', 0);

            this.evaluateNavigation(itemIndex);

            this.moveSliderToIndex(itemIndex, stage, !initial);
        },

        evaluateNavigation: function(itemIndex) {
            var item = this.model.get('_items')[itemIndex];
            var currentStage = item._stage;
            var itemCount = item._itemCount;
            if (currentStage == 0) {
                this.$('.item-'+itemIndex+'.qs-slide-container .qs-control-left').addClass('qs-hidden');

                if (itemCount > 1) {
                    this.$('.item-'+itemIndex+'.qs-slide-container .qs-control-right').removeClass('qs-hidden');
                }
            } else {
                this.$('.item-'+itemIndex+'.qs-slide-container .qs-control-left').removeClass('qs-hidden');

                if (currentStage == itemCount - 1) {
                    this.$('.item-'+itemIndex+'.qs-slide-container .qs-control-right').addClass('qs-hidden');
                } else {
                    this.$('.item-'+itemIndex+'.qs-slide-container .qs-control-right').removeClass('qs-hidden');
                }
            }

        },

        getVisitedItems: function() {
          return _.filter(this.model.get('_items'), function(item) {
                return item.visited;
          });
        },

        onNavigationClicked: function(event) {
            event.preventDefault();

            var $target = $(event.currentTarget);

            if ($target.hasClass('disabled')) return;

            if (!this.model.get('_active')) return;

            var selectedItemIndex = $target.parent('.component-item').index();
            var selectedItemObject = this.model.get('_items')[selectedItemIndex];

            var stage = selectedItemObject._stage,
                numberOfItems = selectedItemObject._itemCount;

            if ($target.hasClass('qs-control-right')) {
                stage++;
                if (stage == numberOfItems-1) {
                    $('.qs-control-left').focus();
                }
            } else if ($target.hasClass('qs-control-left')) {
                stage--;
                if (stage == 0) {
                    $('.qs-control-right').focus();
                }
            }
            stage = (stage + numberOfItems) % numberOfItems;
            this.setStage(selectedItemIndex, stage);
        }

    });

    Adapt.register("questionStrip", QuestionStrip);

    return QuestionStrip;

});

/*
* adapt-slidingPuzzle
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Dennis Heaney <dennis@learningpool.com>
*/
define('components/adapt-slidingPuzzle/js/adapt-slidingPuzzle',['require','coreViews/componentView','coreJS/adapt'],function(require) {

  var ComponentView = require("coreViews/componentView");
  var Adapt = require('coreJS/adapt');

  // sliding tile object
  function SlidingTile (options) {
    return _.extend({
        className: 'slidingPuzzle-tile',
        src: null, // the image to use in the source
        el: null,
        x: 0, // actual x position on puzzle
        y: 0, // actual y position on puzzle
        srcX: 0, // x position on image of this tile
        srcY: 0, // y position on image of this tile
        width: 0,
        height: 0,
        column: -1, // correct column of this tile
        row: -1, // correct row of this tile
        visible: true, // if true, draw this tile
        target: {},

        /**
         * returns a comma separated rect spec suitable for
         * use in a css clip style
         */
        getRect: function () {
          return [
            this.srcY + 'px',
            this.srcX + this.width + 'px',
            this.srcY + this.height + 'px',
            this.srcX + 'px'
          ].join(',');
        },

        /**
         * builds the img element for this tile and returns it
         * ready for use in $.append
         */
        renderElement: function (container) {
          // remove img if already rendered
          if (this.el) {
            this.el.remove();
          }

          // create image element
          var img = $('<img>');
          img.attr('src', this.src);
          img.css('clip', 'rect(' + this.getRect() + ')');
          img.css('left', -this.srcX + 'px');
          img.css('top', -this.srcY + 'px');

          // create element (the tile)
          var el = $('<div>');
          el.attr('class', this.className);
          el.css('left', this.x);
          el.css('top', this.y);
          this.el = el;

          this.el.append(img);
          this.setVisible(this.visible);

          container.append(this.el);

          return this.el;
        },

        /**
         * toggles display of the tile
         */
        setVisible: function (visible) {
          this.visible = visible;
          if (this.el) {
            this.el.css('opacity', (this.visible ? '100' : '0'));
          }
        },

        /**
         * sets the target x and y for this tile
         *
         */
        setTarget: function (target) {
          this.target.x = target.x;
          this.target.y = target.y;

          // immediately set to position
          if (this.el) {
            this.el.css('left', this.target.x);
            this.el.css('top', this.target.y);
          }
        }
      }, options);
  }

  var SlidingPuzzle = ComponentView.extend({

    events: {
      'click .slidingPuzzle-puzzle': 'attemptMove',
      'click .slidingPuzzle-widget .button.reset': 'onResetClicked',
      'click .slidingPuzzle-widget .button.model': 'onShowSolutionClicked'
    },

    _columns: 1,

    _rows: 1,

    _tiles: [],

    img: false,

    context: false,

    _debounceTime: 250,

    _debouncing: false,

    preRender: function () {
      this.listenTo(Adapt, 'device:changed', this.resizePuzzle);
    },

    postRender: function () {
      this.resizePuzzle(Adapt.device.screenSize);
    },

    resizePuzzle: function (width) {
      var img = this.$('.slidingPuzzle-widget img');
      img.attr('src', img.attr('data-' + width));

      this.$('.slidingPuzzle-widget').imageready(_.bind(function (imgEl) {
        this.resetPuzzle(imgEl);
      }, this, img.get(0)));
    },

    resetPuzzle: function (img) {
      var graphic = this.model.get('graphic');
      var puzzle = this.$('.slidingPuzzle-puzzle');
      puzzle.html('');
      this.img = img;

      // set up the puzzle board
      puzzle.css('width', this.img.width + 'px');
      puzzle.css('height', this.img.height + 'px');
      this._columns = this.model.get('dimension') || this._columns;
      this._rows = this.model.get('dimension') || this._rows;
      this._tiles = this.fetchTiles(this.img, this._columns, this._rows);

      // show/hide buttons
      this.$('.slidingPuzzle-widget .button.reset').hide();
      if (this.model.get('allowSkip')) {
        this.$('.slidingPuzzle-widget .button.model').show();
      }

      this.renderTiles(puzzle);

      // get debounce time from transition time
      var transTime = parseFloat(this.$('.slidingPuzzle-tile').first().css('transition-duration'), 10);
      this._debounceTime = transTime ? transTime * 1000 : this._debounceTime;


      this.setReadyStatus();
    },

    showAll: function () {
      for (var row = 0; row < this._tiles.length; ++row) {
        for (var col = 0; col < this._tiles[row].length; ++col) {
          var tile = this._tiles[row][col];
          tile.setTarget({x:tile.srcX, y:tile.srcY});
          tile.setVisible(true);
        }
      }
    },

    renderTiles: function (el) {
      for (var row = 0; row < this._tiles.length; ++row) {
        for (var col = 0; col < this._tiles[row].length; ++col) {
          this._tiles[col][row].renderElement(el);
        }
      }
    },

    fetchTiles: function (img, dimensionX, dimensionY) {
      var tiles = [];
      var tileWidth = Math.floor(img.width / (dimensionX || 1));
      var tileHeight = Math.floor(img.height / (dimensionY || 1));
      var col = 0;
      var row = 0;
      for (col = 0; col < dimensionX; ++col) {
        for (row = 0; row < dimensionY; ++row) {
          tiles.push(new SlidingTile({ src: img.src, srcX: col*tileWidth, srcY: row*tileHeight, width: tileWidth, height: tileHeight, column: col, row: row }));
        }
      }

      var randomTiles = [];
      var index = 0;
      while (tiles.length > 0) {
        if (index % dimensionX === 0) {
          randomTiles.push([]);
        }
        var t = tiles.splice(Math.floor(Math.random()*tiles.length), 1)[0];
        col = index % dimensionX;
        row = Math.floor(index / dimensionY);
        if (tiles.length !== 0) {
          t.x = col * t.width;
          t.y = row * t.height;
          t.setVisible(true);
        } else {
          t.setVisible(false); // make the last tile invisible
        }
        randomTiles[row].push(t);
        ++index;
      }

      return randomTiles;
    },

    attemptMove: function (e) {
      if (this._debouncing) {
        return;
      }
      var puzzlePos = this.$('.slidingPuzzle-puzzle').offset();
      var mouseX = e.pageX - Math.round(puzzlePos.left);
      var mouseY = e.pageY - Math.round(puzzlePos.top);
      var cellX = Math.floor(mouseX/this.img.width * this._columns);
      var cellY = Math.floor(mouseY/this.img.height * this._rows);
      if (this._tiles[cellY][cellX]) {
        var freeCell = false;
        // check if we can move to any postion
        // up or down?
        for (var row = 0; row < this._rows; ++row) {
          if (row === cellY) { // ignore self
            continue;
          }

          if (!this._tiles[row][cellX].visible) {
            // boom, found a free cell
            freeCell = {col: cellX, row: row};
            break
          }
        }

        if (!freeCell) {
          // check left and right
          for (var col = 0; col < this._columns; ++col) {
            if (col === cellX) { // ignore self
              continue;
            }

            if (!this._tiles[cellY][col].visible) {
              // boom, found a free cell
              freeCell = {col: col, row: cellY};
              break;
            }
          }
        }

        if (freeCell) {
          var tile = false;
          // move multiple tiles if we can
          if (freeCell.col === cellX) { // same column
            var direction = freeCell.row > cellY ? -1 : 1;
            for (; freeCell.row >= 0 && freeCell.row != this._rows; freeCell.row += direction) {
              var currentRow = freeCell.row + direction;
              tile = this._tiles[currentRow][cellX];
              tile.setTarget({x: cellX * tile.width, y: freeCell.row * tile.height});
              // swap tiles
              this.swapTiles(currentRow, cellX, freeCell.row, cellX);
              // stop when we reach the clicked cell
              if (currentRow === cellY) {
                break;
              }
            }
          } else { // same row
            var direction = freeCell.col > cellX ? -1 : 1;
            for (; freeCell.col >= 0 && freeCell.col != this._columns; freeCell.col += direction) {
              var currentCol = freeCell.col + direction;
              tile = this._tiles[cellY][currentCol];
              tile.setTarget({x: freeCell.col * tile.width, y: cellY * tile.height});
              // swap tiles
              this.swapTiles(cellY, currentCol, cellY, freeCell.col);
              // stop when we reach the clicked cell
              if ((freeCell.col + direction) === cellX) {
                break;
              }
            }
          }
          this.debounce();
        }

        // assess completion!
        if (this.checkPuzzle()) {
          // w00t! player got skillz
          this.solve();
        }
      }
    },

    debounce: function () {
      this._debouncing = true;
      setTimeout(_.bind(function () { this._debouncing = false; }, this), this._debounceTime);
    },

    solve: function () {
      this.$('.slidingPuzzle-widget .button.model').hide();
      this.$('.slidingPuzzle-widget .button.reset').show();
      this.showAll();
      this.puzzleComplete();
    },

    onResetClicked: function (e) {
      e.preventDefault();
      this.resetPuzzle(this.img);
    },

    onShowSolutionClicked: function (e) {
      e.preventDefault();
      this.solve();
    },

    swapTiles: function (row1, col1, row2, col2) {
      var temp = this._tiles[row1][col1];
      this._tiles[row1][col1] = this._tiles[row2][col2];
      this._tiles[row2][col2] = temp;
    },

    checkPuzzle: function () {
      for (var row = 0; row < this._tiles.length; ++row) {
        for (var col = 0; col < this._tiles[row].length; ++col) {
          var tile = this._tiles[row][col];
          if (tile.column !== col || tile.row !== row) {
            // not in order
            return false;
          }
        }
      }
      return true;
    },

    puzzleComplete: function () {
      this.setCompletionStatus();
    }

  });

  Adapt.register('slidingPuzzle', SlidingPuzzle);

  return SlidingPuzzle;

});

define('components/adapt-tabs/js/adapt-tabs',['require','coreViews/componentView','coreJS/adapt'],function(require) {

	var ComponentView = require('coreViews/componentView');
	var Adapt = require('coreJS/adapt');

	var Tabs = ComponentView.extend({

		events: {
			'click .tabs-navigation-item': 'onTabItemClicked'
		},
		
		preRender: function() {
		},

		postRender: function() {
			this.setReadyStatus();
			this.setLayout();
			this.listenTo(Adapt, 'device:resize', this.setLayout);
			this.showContentItemAtIndex(0, true);
			this.setTabSelectedAtIndex(0);
		},

		setLayout: function() {
			this.$el.removeClass("tab-layout-left tab-layout-top");
			if (Adapt.device.screenSize == 'large') {
				var tabLayout = this.model.get('_tabLayout');
				this.$el.addClass("tab-layout-" + tabLayout);
				if (tabLayout === 'top') {
					this.setTabLayoutTop();
				} else if (tabLayout === 'left') {
					this.setTabLayoutLeft();
				}
			} else {
				this.$el.addClass("tab-layout-left");
				this.setTabLayoutLeft();
			}
		},

		setTabLayoutTop: function() {
			var itemsLength = this.model.get('_items').length;
			var itemWidth = 100 / itemsLength;

			this.$('.tabs-navigation-item').css({
				width: itemWidth + '%'
			});
		},

		setTabLayoutLeft: function() {
			this.$('.tabs-navigation-item').css({
				width: 100 + '%'
			});
		},

		onTabItemClicked: function(event) {
			event.preventDefault();
			var index = $(event.currentTarget).index();
			this.showContentItemAtIndex(index);
			this.setTabSelectedAtIndex(index);
			this.setVisited($(event.currentTarget).index());
		},

		showContentItemAtIndex: function(index, skipFocus) {
			var $contentItems = this.$('.tab-content');

			$contentItems.removeClass('active').velocity({
				opacity: 0,
				translateY: '20px'
			}, {
				duration: 0,
				display: 'none'
			});

			var $contentItem = $contentItems.eq(index);
			$contentItem.velocity({
				opacity: 1,
				translateY: '0'
			}, {
				duration: 300,
				display: 'block',
				complete: _.bind(complete,this)
			});

			function complete() {
				if (skipFocus) return;
	            $contentItem.addClass('active').a11y_focus();
			}
		},

		setTabSelectedAtIndex: function(index) {
			var $navigationItem = this.$('.tabs-navigation-item-inner');
			$navigationItem.removeClass('selected').eq(index).addClass('selected visited').attr('aria-label', this.model.get("_items")[index].tabTitle + ". Visited");
			this.setVisited(index);
		},

		setVisited: function(index) {
			var item = this.model.get('_items')[index];
			item._isVisited = true;
			this.checkCompletionStatus();
		},

		getVisitedItems: function() {
			return _.filter(this.model.get('_items'), function(item) {
				return item._isVisited;
			});
		},

		checkCompletionStatus: function() {
			if (this.getVisitedItems().length == this.model.get('_items').length) {
				this.setCompletionStatus();
			}
		}
	},{
      template: 'tabs'
   });
	
	Adapt.register("tabs", Tabs);

	return Tabs;
	
});

define('components/adapt-timedSequence/js/adapt-timed-sequence',['require','coreViews/questionView','coreJS/adapt'],function(require) {

	var QuestionView = require("coreViews/questionView");
	var Adapt = require("coreJS/adapt");

	var TimedSequence = QuestionView.extend({

		events: {
			"click .sequence-start-button":"onStartClicked",
			"click .sequence-answer-button":"onAnswerClicked"
		},

		preRender:function(){
			QuestionView.prototype.preRender.apply(this);

			_.bindAll(this, "onWidgetImageReady", "onTimerInterval", "onQuestionComplete", "updateSequence");

			this.listenTo(Adapt, "device:changed device:resize", this.setupLayout);
		},

		postRender: function() {
			QuestionView.prototype.postRender.apply(this);
			this.$(".timed-sequence-widget").imageready(this.onWidgetImageReady);
		},

		setupLayout: function() {
			this.width = this.$(".sequence-container").width();
			this.$(".sequence-container-inner").css("width", this.width * this.model.get("_items").length);
			this.$(".sequence-image").css("width", this.width);
		},

		setupSequenceIndicators: function() {
			var itemsLength = this.model.get("_items").length;
			this.$(".sequence-indicator").css("width", (100/itemsLength) + "%");
		},

		resetData: function() {
			this.model.set({
				_userAnswers: [],
				_currentStageIndex: 0,
				_lastStageAnswered: -1,
				_correctAnswers: 0,
				_incorrectAnswers: 0
			});
		},

		startTimer: function() {
			var timerInterval = this.model.get("_timerInterval")*1000;
			this.timer = setInterval(this.onTimerInterval, timerInterval);
		},

		stopTimer: function() {
			clearInterval(this.timer);
			this.timer = -1;
		},

		updateSequence: function() {
			this.markAnswer(this.model.get("_currentStageIndex"));

			if (this.atLastStage()) this.endSequence();
			else this.showNextImage();
		},

		showNextImage: function() {
			this.model.set("_currentStageIndex", this.model.get("_currentStageIndex")+1);
			var leftMarg = -(this.model.get("_currentStageIndex") * this.width);
			this.$(".sequence-container-inner").velocity({ marginLeft: leftMarg + "px" });
			this.updateIndicator();

			if(this.timer === -1) this.startTimer();
		},

		endCurrentStage: function() {
			var $indicator = this.$(".sequence-indicator").eq(this.model.get("_currentStageIndex"));
			$indicator.children(".sequence-indicator-inner").stop().animate({ width:"100%" }, 500, this.updateSequence);
		},

		endSequence: function() {
			this.stopTimer();
			this.$(".sequence-state-container").addClass("complete");
			this.$(".sequence-answer-button").removeClass("show");
			this.$(".sequence-complete-button").addClass("show");
			this.$(".sequence-state-container").velocity("reverse", this.onQuestionComplete);
		},

		markAnswer: function(index) {
			var userDidInteract = this.userDidInteract();
			var shouldBeSelected = this.model.get("_items")[index]._shouldBeSelected;
			var correctInteraction = (userDidInteract && shouldBeSelected) || (!userDidInteract && !shouldBeSelected);

			this.model.get("_userAnswers").push({
				_stageID: index,
				_isCorrect:correctInteraction
			});

			if(correctInteraction) this.model.set("_correctAnswers", this.model.get("_correctAnswers")+1);
			else this.model.set("_incorrectAnswers", this.model.get("_incorrectAnswers")+1);

			this.showIndicatorMarking();
			this.showSequenceFeedback(this.model.get("_userAnswers")[index]);
		},

		updateIndicator: function() {
			var timerInterval = this.model.get("_timerInterval")*1000;
			var $indicator = this.$(".sequence-indicator").eq(this.model.get("_currentStageIndex"));
			var $indicatorInner = $indicator.children(".sequence-indicator-inner");
			$indicatorInner.animate({ width:"100%" }, timerInterval);
		},

		showIndicatorMarking: function() {
			_.each(this.model.get("_userAnswers"), _.bind(function(item, index) {
				var $indicator = this.$(".sequence-indicator").eq(index);
				var iconClass = (item._isCorrect) ? ".icon-tick" : ".icon-cross";
				$indicator.children(iconClass).addClass("show");
			}, this));
		},

		showSequenceFeedback: function(userAnswer) {
			var $feedbackContainer = this.$(".sequence-feedback-container");
			var iconClass = (userAnswer._isCorrect) ? ".icon-tick" : ".icon-cross";
			this.animateFeedbackIcon($feedbackContainer.children(iconClass));
		},

		animateFeedbackIcon: function($element) {
			// quickly fade in, then fade out immediately
			$element.velocity({ opacity: 1 }, 50, function() {
				$element.velocity({ opacity: 0 }, 500);
			});
		},
		
		isCorrect: function() {
			return this.model.get("_correctAnswers") === this.model.get("_items").length;
		},

		isPartlyCorrect: function() {
			return this.model.get("_incorrectAnswers") <= this.model.get("_answerLeniency");
		},

		userDidInteract: function() {
			return this.model.get("_lastStageAnswered") === this.model.get("_currentStageIndex");
		},

		atLastStage: function() {
			return this.model.get("_currentStageIndex") == this.model.get("_items").length-1;
		},

		/**
		* Event handling
		*/
		onWidgetImageReady: function() {
			this.resetData();
			this.setupLayout();
			this.setupSequenceIndicators();
			this.setReadyStatus();
		},

		onStartClicked: function(event) {
			if (event) event.preventDefault();

			this.$(".sequence-state-container").velocity({ top:"-100%" },{ duration:800, easing:"swing" });
			this.$(".sequence-start-button").removeClass("show");
			this.$(".sequence-answer-button").addClass("show");

			this.startTimer();
			this.updateIndicator();
		},

		onAnswerClicked: function(event) {
			if (event) event.preventDefault();

			if (this.model.get("_lastStageAnswered") == this.model.get("_currentStageIndex")) return;
			this.model.set("_lastStageAnswered", this.model.get("_currentStageIndex"));
			this.stopTimer();
			this.endCurrentStage();
		},

		onQuestionComplete: function() {
			this.setCompletionStatus();
			this.updateAttempts();
			this.setQuestionAsSubmitted();
			this.markQuestion();
			this.setScore();
			this.setupFeedback();
			this.showFeedback();
		},

		onTimerInterval: function() {
			this.updateSequence();
		}
	},{
		template: "timed-sequence"
	});

	Adapt.register("timed-sequence", TimedSequence);

	return TimedSequence;
});
/*
* adapt-youtube
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Oliver Foster <oliver.foster@kineo.com>, Matt Leathes <matt.leathes@kineo.com>
*/
define('components/adapt-youtube/js/adapt-youtube',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var youtube = ComponentView.extend({
        defaults:function() {
            return {
                player:null
            }
        },

        initialize: function() {
            ComponentView.prototype.initialize.apply(this);

            _.bindAll(this, 'onPlayerStateChange', 'onPlayerReady', 'onInview');

            if (window.onYouTubeIframeAPIReady === undefined) {
                window.onYouTubeIframeAPIReady = function() {
                    console.info('YouTube iframe API loaded');
                    Adapt.youTubeIframeAPIReady = true;
                    Adapt.trigger('youTubeIframeAPIReady');
                };
                $.getScript('//www.youtube.com/iframe_api');
            }
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:resize', this.setIFrameSize);
            this.listenTo(Adapt, 'device:changed', this.setIFrameSize);
        },

        setIFrameSize: function () {
            this.$('iframe').width(this.$('.component-widget').width());
            
            var aspectRatio = (this.model.get("_media")._aspectRatio ? parseFloat(this.model.get("_media")._aspectRatio) : 1.778);//default to 16:9 if not specified
            if (!isNaN(aspectRatio)) {
                this.$('iframe').height(this.$('.component-widget').width() / aspectRatio);
            }
        },

        postRender: function() {
            //FOR HTML/HBS Paramenters: https://developers.google.com/youtube/player_parameters
            if (Adapt.youTubeIframeAPIReady === true) {
                this.onYouTubeIframeAPIReady();
            } else {
                Adapt.once('youTubeIframeAPIReady', this.onYouTubeIframeAPIReady, this)
            }
        },

        remove: function() {
            if(this.player != null) {
                this.player.destroy();
            }

            ComponentView.prototype.remove.call(this);
        },
    
        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'play' : this.model.get('_setCompletionOn');
            if (this.completionEvent === "inview") {
                this.$('.component-widget').on('inview', this.onInview);
            }

            // add listener for other youtube components on the page, so that we can prevent multiple video playback
            this.listenTo(Adapt, 'adapt-youtube:playbackstart', this.onYouTubePlaybackStart)
        },

        onInview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        onYouTubeIframeAPIReady: function() {
            //console.info('onYouTubeIframeAPIReady');
	    this.player = new YT.Player(this.$('iframe').get(0), {
                events: {
                    'onStateChange': this.onPlayerStateChange,
                    'onReady': this.onPlayerReady
                }
            });

            this.isPlaying = false;
            
            this.setReadyStatus();
            
            this.setupEventListeners();
            
            this.setIFrameSize();
        },

        /**
        * if another YouTube video starts playback whilst this one is playing, pause this one.
        * prevents user from playing multiple videos on the page at the same time
        */
        onYouTubePlaybackStart: function(component) {
            if(component != this && this.isPlaying) {
                this.player.pauseVideo();
            }
        },

        onPlayerReady: function() {
            if (this.model.get("_media")._playbackQuality) {
                this.player.setPlaybackQuality(this.model.get("_media")._playbackQuality);
            }
        },

        /**
        * this seems to have issues in Chrome if the user is logged into YouTube (possibly any Google account) - the API just doesn't broadcast the events
        * but instead throws the error:
        * Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('https://www.youtube.com') does not match the recipient window's origin ('http://www.youtube.com').
        * This is documented here:
        *   https://code.google.com/p/gdata-issues/issues/detail?id=5788
        * but I haven't managed to get any of the workarounds to work... :-(
        */
        onPlayerStateChange: function(event) {
            switch(event.data) {
                case YT.PlayerState.PLAYING:
                    Adapt.trigger('adapt-youtube:playbackstart', this);
                    
                    this.isPlaying = true;

                    if(this.model.get('_setCompletionOn') && this.model.get('_setCompletionOn') === "play") {
                        this.setCompletionStatus();
                    }
                break;
                case YT.PlayerState.PAUSED:
                    this.isPlaying = false;
                break;
                case YT.PlayerState.ENDED:
                    if(this.model.get('_setCompletionOn') && this.model.get('_setCompletionOn') === "ended") {
                        this.setCompletionStatus();
                    }
                break;
            }
            //console.log("this.onPlayerStateChange: " + this.isPlaying);
        }
    },
    {
        template: 'youtube'
    });
    
    Adapt.register("youtube", youtube );

    return youtube;
});

define('menu/adapt-contrib-boxMenu/js/adapt-contrib-boxmenu',[
    'coreJS/adapt',
    'coreViews/menuView'
], function(Adapt, MenuView) {

    var BoxMenuView = MenuView.extend({

        postRender: function() {
            var nthChild = 0;
            this.model.getChildren().each(function(item) {
                if (item.get('_isAvailable')) {
                    nthChild++;
                    item.set("_nthChild", nthChild);
                    this.$('.menu-container-inner').append(new BoxMenuItemView({model: item}).$el);
                }
            });
        }

    }, {
        template: 'boxmenu'
    });

    var BoxMenuItemView = MenuView.extend({

        events: {
            'click button' : 'onClickMenuItemButton'
        },

        className: function() {
            var nthChild = this.model.get("_nthChild");
            return [
                'menu-item',
                'menu-item-' + this.model.get('_id') ,
                this.model.get('_classes'),
                this.model.get('_isVisited') ? 'visited' : '',
                this.model.get('_isComplete') ? 'completed' : '',
                this.model.get('_isLocked') ? 'locked' : '',
                'nth-child-' + nthChild,
                nthChild % 2 === 0 ? 'nth-child-even' : 'nth-child-odd'
            ].join(' ');
        },

        preRender: function() {
            this.model.checkCompletionStatus();
            this.model.checkInteractionCompletionStatus();
        },

        postRender: function() {
            var graphic = this.model.get('_graphic');
            if (graphic && graphic.src && graphic.src.length > 0) {
                this.$el.imageready(_.bind(function() {
                    this.setReadyStatus();
                }, this));
            } else {
                this.setReadyStatus();
            }
        },

        onClickMenuItemButton: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            if(this.model.get('_isLocked')) return;
            Backbone.history.navigate('#/id/' + this.model.get('_id'), {trigger: true});
        }

    }, {
        template: 'boxmenu-item'
    });

    Adapt.on('router:menu', function(model) {

        $('#wrapper').append(new BoxMenuView({model: model}).$el);

    });

});

define('theme/adapt-contrib-vanilla/js/theme-block',['require','coreJS/adapt','backbone'],function(require) {
	
	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');

	var ThemeBlockView = Backbone.View.extend({

		initialize: function() {
			this.setStyles();
			this.listenTo(Adapt, 'device:resize', this.setStyles);
			this.listenTo(Adapt, 'remove', this.remove);
		},

		setStyles: function() {
			this.setBackground();
			this.setMinHeight();
			this.setDividerBlock();
		},

		setBackground: function() {
			var backgroundColor = this.model.get('_themeBlockConfig')._backgroundColor;
			
			if (backgroundColor) {
				this.$el.addClass(backgroundColor);
			}
		},

		setMinHeight: function() {
			var minHeight = 0;
			var minHeights = this.model.get('_themeBlockConfig')._minimumHeights;

			if (minHeights) {

				if(Adapt.device.screenSize == 'large') {
					minHeight = minHeights._large;
				} else if (Adapt.device.screenSize == 'medium') {
					minHeight = minHeights._medium;
				} else {
					minHeight = minHeights._small;
				}
			}

			this.$el.css({
				minHeight: minHeight + "px"
			});
		},

		setDividerBlock: function() {
			var dividerBlock = this.model.get('_themeBlockConfig')._isDividerBlock;

			if (dividerBlock) {
				this.$el.addClass('divider-block');
			}
		}
	});

	return ThemeBlockView;
	
});

define('theme/adapt-contrib-vanilla/js/vanilla',['require','coreJS/adapt','backbone','theme/adapt-contrib-vanilla/js/theme-block'],function(require) {
	
	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var ThemeBlock = require('theme/adapt-contrib-vanilla/js/theme-block');

	// Block View
	// ==========

	Adapt.on('blockView:postRender', function(view) {
		var theme = view.model.get('_theme');
		
		if (theme) {
			new ThemeBlock({
				model: new Backbone.Model({
					_themeBlockConfig: theme
				}),
				el: view.$el
			});
		}
	});
});

define('plugins',[
	"extensions/adapt-article-reveal/js/adapt-article-reveal",
	"extensions/adapt-audio/js/adapt-audio",
	"extensions/adapt-background-video/js/adapt-background-video",
	"extensions/adapt-backgroundVideo/js/adapt-backgroundVideo",
	"extensions/adapt-component-animate/js/adapt-component-animate",
	"extensions/adapt-contrib-assessment/js/adapt-assessmentArticleExtension",
	"extensions/adapt-contrib-bookmarking/js/adapt-contrib-bookmarking",
	"extensions/adapt-contrib-languagePicker/js/adapt-languagePicker",
	"extensions/adapt-contrib-pageLevelProgress/js/adapt-contrib-pageLevelProgress",
	"extensions/adapt-contrib-resources/js/adapt-contrib-resources",
	"extensions/adapt-contrib-spoor/js/adapt-contrib-spoor",
	"extensions/adapt-contrib-trickle/js/adapt-contrib-trickle",
	"extensions/adapt-contrib-tutor/js/adapt-contrib-tutor",
	"extensions/adapt-devtools/js/adapt-devtools",
	"extensions/adapt-editorial/js/adapt-editorialArticleExtension",
	"extensions/adapt-forceLoad/js/adapt-forceLoad",
	"extensions/adapt-hide-navigation-bar/js/adapt-hide-navigation-bar",
	"extensions/adapt-inspector/js/adapt-inspector",
	"extensions/adapt-ios-fastclick/js/adapt-ios",
	"extensions/adapt-lightbox/js/adapt-lightbox",
	"extensions/adapt-menu-controller/js/adapt-menu-controller",
	"extensions/adapt-navigation-title/js/adapt-navigation-title",
	"extensions/adapt-pageIncompletePrompt/js/adapt-pageIncompletePrompt",
	"extensions/adapt-speedtest/js/adapt-speedtest",
	"extensions/adapt-tutor/js/adapt-tutor",
	"components/adapt-article-reveal/js/adapt-article-reveal",
	"components/adapt-articleBlockSlider/js/articleBlockSlider",
	"components/adapt-audio/js/adapt-audio",
	"components/adapt-backgroundScroll/js/adapt-backgroundScroll",
	"components/adapt-blinds/js/adapt-blinds",
	"components/adapt-contrib-accordion/js/adapt-contrib-accordion",
	"components/adapt-contrib-assessmentResults/js/adapt-contrib-assessmentResults",
	"components/adapt-contrib-blank/js/adapt-contrib-blank",
	"components/adapt-contrib-confidenceSlider/js/adapt-contrib-confidenceSlider",
	"components/adapt-contrib-flipcard/js/adapt-contrib-flipcard",
	"components/adapt-contrib-gmcq/js/adapt-contrib-gmcq",
	"components/adapt-contrib-graphic/js/adapt-contrib-graphic",
	"components/adapt-contrib-hotgraphic/js/adapt-contrib-hotgraphic",
	"components/adapt-contrib-matching/js/adapt-contrib-matching",
	"components/adapt-contrib-mcq/js/adapt-contrib-mcq",
	"components/adapt-contrib-media/js/adapt-contrib-media",
	"components/adapt-contrib-narrative/js/adapt-contrib-narrative",
	"components/adapt-contrib-slider/js/adapt-contrib-slider",
	"components/adapt-contrib-text/js/adapt-contrib-text",
	"components/adapt-contrib-textInput/js/adapt-contrib-textInput",
	"components/adapt-expose/js/adapt-expose",
	"components/adapt-hotgrid/js/adapt-hotgrid",
	"components/adapt-narrativeStrip/js/adapt-narrativeStrip",
	"components/adapt-native-media/js/adapt-native-media",
	"components/adapt-peelBackHotspot/js/adapt-peelBackHotspot",
	"components/adapt-ppq/js/adapt-ppq",
	"components/adapt-questionStrip/js/adapt-questionStrip",
	"components/adapt-slidingPuzzle/js/adapt-slidingPuzzle",
	"components/adapt-tabs/js/adapt-tabs",
	"components/adapt-timedSequence/js/adapt-timed-sequence",
	"components/adapt-youtube/js/adapt-youtube",
	"menu/adapt-contrib-boxMenu/js/adapt-contrib-boxmenu",
	"theme/adapt-contrib-vanilla/js/vanilla"
],function(){});

//# sourceMappingURL=plugins.js.map