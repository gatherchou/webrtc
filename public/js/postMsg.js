function postMsg(name, msg, time) {
	var timestamp = getToday(time);
	$messages.append($('<li>').text("[" + timestamp + "] " + name + " : " + msg));
}

function getToday(time){
	var now;

	time ? now = new Date(time) : now = new Date();

	let year = now.getFullYear();
	let month = now.getMonth() + 1;
	let date = now.getDate();
	let hour = addZero(now.getHours());
	let min = addZero(now.getMinutes());
	let sec = addZero(now.getSeconds());

	let today = month + "/" + date + "-" + hour + ":" + min;

	return today;
}

function addZero(x){
	if (x < 10) {
		x = "0"+x;
	}

	return x;
}