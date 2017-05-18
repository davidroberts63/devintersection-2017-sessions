$(function() {
    var allTalks = [];

    $("#site-toolbar").toolbar({ theme: "a" });

    $("#conference-day").on("change", function() { $.mobile.navigate("#sessions-page"); displayTalks(); });
    $("#conference-track").on("change", function() { $.mobile.navigate("#sessions-page"); displayTalks(); });

    function getValues() {
        selectedDay = $("#conference-day").val();
        selectedTrack = $("#conference-track").val();
        selectedChoice = $("#choiceFilter").val()
    }

    function setupControls() {
        $("#fake-list").hide();
        $("#sessions-list input[type='radio']").change(saveChoice);
        $("#sessions-list input[type='radio']").map(loadChoice);				
        $(".map-button").on("click", showMap);
    }

    function displayTalks() {
        if(!sessionSelectionHasChanged()) {
            return;
        }
        getValues();
        console.debug("Showing %s talks on %s decided on %s", selectedTrack, selectedDay, selectedChoice);

        var sessionsList = $("#sessions-list");
        sessionsList.children().remove();
        var res = allTalks
            .filter(forTalksOn(selectedDay))
            .filter(forTalksIn(selectedTrack))
            .filter(forTalksDecided(selectedChoice))
            .reduce(toSingleHtmlSource(), "");
        talkToListing(res, sessionsList);
        sessionsList.listview().listview("refresh");

        var groups = $("#sessions-list li div");
        groups.controlgroup().controlgroup("refresh");
        window.listDividers = $("li[data-role='list-divider']").get().reverse();

        setupControls();
    };

    function byStartTimeAndTitle(a, b) {
        if(a.startTime < b.startTime) return -1;
        if(b.startTime < a.startTime) return 1;
        // Times are same, sort by title
        if(a.title < b.title) return -1;
        if(b.title < a.title) return 1;
        
        // Seriously, same time AND title?
        return 0;
    }

    function byId(id) {
        return function(item) {
            return item.id == id;
        }
    }

    function forTalksOn(selectedDay) {
        return function(item, index, arr) { 
            return item.day == selectedDay;
        }
    };

    function forTalksDecided(selectedChoice) {
        return function(item, index, arr) {
            return selectedChoice == "all" || localStorage.getItem("going-" + item.id) == selectedChoice;
        }
    }

    function forTalksIn(selectedTrack) {
        return function(item, index, arr) {
            return selectedTrack == "all" || item.track == selectedTrack;
        }
    }

    function formatTime(time) {
        // Force displaying in the time zone the conference is in, no matter where the user may be.
        var hour = time.getUTCHours() + timeZoneOffset;
        var result = "" + (hour > 12 ? hour - 12 : hour);
        result += ":" + ("00" + time.getMinutes()).slice(-2);
        result += hour >= 12 ? "PM" : "AM";
        return result;
    }

    function parseTimes(item) {
        var startParsed = new Date(item.startTime);
        var endParsed = new Date(item.endTime);
        item.startTime = startParsed;
        item.endTime = endParsed;
        item.day = startParsed.getDay();
        item.slot = formatTime(startParsed) + " - " + formatTime(endParsed);
    };

    function getTalkData() {
        $.getJSON("talks.json").done(function(data) {
            allTalks = data;
            window.allTalks = allTalks;
            allTalks.map(parseTimes);
            allTalks = allTalks.sort(byStartTimeAndTitle);
        });
    }

    var talkTemplate = null;

    function toSingleHtmlSource() {
        var timeslot = null;
        return function(result, talk) {
            if (talk.slot != timeslot) {
                timeslot = talk.slot;
                result += nano("a-timeslot", { slot: talk.slot });
            }
            return result += nano("a-talk", talk);
        }
    }

    function talkToListing(htmlSource, listing) {
        listing.append(htmlSource);
    }

    function saveChoice(ev) {
        console.log("Saving choice: %s %s", ev.target.name, ev.target.value);
        localStorage.setItem(ev.target.name, ev.target.value);
    }

    function loadChoice(index, item) {
        var value = localStorage.getItem(item.name);
        if(item.value == value) {
            $(item).attr("checked", true).checkboxradio("refresh");
        }
    }

    function showMap() {
        mapTalkId = this.getAttribute("data-talkid");
        $.mobile.navigate("#session-map");
    }

    function showBackToSessionsButton() {
        $("#fake-header").hide();
        $("#fake-list").show();
        $("#back-to-sessions").show();	
    }

    function sessionSelectionHasChanged() {
        return selectedDay != $("#conference-day").val() 
            || selectedTrack != $("#conference-track").val()
            || selectedChoice != $("#choiceFilter").val();
    }

    getTalkData();

    $(document).on("scroll", function() {
        if($.mobile.activePage[0].id == "sessions-page") {
            $("#back-to-sessions").hide();
            window.processDivider(
                window.listDividers.find(window.firstHeaderScrolledOutOfView)					
            );					
        }
    });

    $(document).on("pagebeforeshow", "#sessions-page", function() { 
        $("#fake-list").hide();
        $("#fake-header").show();
        $("#back-to-sessions").hide();

        if(!document.getElementById("choiceFilter")) {
            var template = document.getElementById("talkChoiceFilterSource").innerHTML;
            $(template)
                .appendTo("#sessions-listing form.ui-filterable")
                .selectmenu()
                .on("change", function() { 
                    displayTalks(); 
                });
        }

        displayTalks();
    });

    $(document).on("pageinit", "#home-page", function() {
        showBackToSessionsButton();
    });
    $(document).on("pagebeforeshow", "#home-page", showBackToSessionsButton);
    $(document).on("pagebeforeshow", "#sponsors-page", showBackToSessionsButton);
    $(document).on("pagebeforeshow","#session-map", function( event, ui ) {
        showBackToSessionsButton();

        if(previousRoom != null) {
            talkRoom = talkRoom.toLowerCase().replace(" ","");
            var textEle = document.getElementById(talkRoom);
            textEle.removeAttribute("filter");
            $(textEle).removeClass("focus");
            document.getElementById("map-talk-name").innerText = "";
        }
        if(mapTalkId != null) {
            var talk = allTalks.find(byId(mapTalkId));
            document.getElementById("map-talk-name").innerText = talk.title;
            talkRoom = talk.room.toLowerCase().replace(" ","");
            var textEle = document.getElementById(talkRoom);
            if(textEle) {
                // filter="url(#solid)"
                textEle.setAttribute("filter", "url(#solid)");
                $(textEle).addClass("focus");
            }
            previousRoom = talkRoom;
            mapTalkId = null;
        }
    });

    var selectedChoice = null;
    var selectedDay = null;
    var selectedTrack = null;
    var mapTalkId = null;
    var previousRoom = null;
    var timeZoneOffset = -4;
});

listDividers = $("li[data-role='list-divider']").get().reverse();
currentHeader = null;

processDivider = function(item) {
    if(!item && currentHeader != null) {
        $("#fake-list").hide();
    }

    if(item && item != currentHeader) {
        currentHeader = item;
        $("#fake-header")[0].innerText = 
            item.innerText;
        $("#fake-list").show();
    }
}

firstHeaderScrolledOutOfView = function(item) {
    return item.getBoundingClientRect().bottom < 75;
}
