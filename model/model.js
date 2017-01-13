var mongoose = require('mongoose');
var msgSchema = mongoose.Schema({
	name: { type: String},
	msg: {type: String},
	time: { type: Date, default:Date.now}
});

module.exports = mongoose.model('chat_history', msgSchema);