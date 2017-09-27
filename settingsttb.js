var fs = require('fs');
var mkdirp = require('mkdirp');
var os = require('os');
var uuid = require('uuid');

var cp = require('child_process');

var settings_folder = "/root/userdir";
var settings_filename = settings_folder + "/thethingbox.json";
var settings_folder2 = "/root"
var settings_filename2 = settings_folder2 + "/settings.json";
var alllowSettings = ["rsa","email","account_id","lang","showall","enableBackup","lastBackup"];

function loadSettings(){
	var settings = undefined;
	var setting1, setting2;
	try {
		var t = fs.readFileSync(settings_filename).toString();
		setting1 = JSON.parse(t);
	}
	catch(e) {
		var certs_folder = "/root/certs";
		setting1 = {"rsa"		: { "server":{"publicKey":certs_folder+"/serv.pub"},
									"publicKey":certs_folder+"/my-ttb.pub",
									"privateKey":certs_folder+"/my-ttb.key.pem" 
								}
		};
		createRSAKey(certs_folder);
		createSettings(settings_folder,settings_filename,setting1);
	}
	try {
		var t = fs.readFileSync(settings_filename2).toString();
		setting2 = JSON.parse(t);
	}
	catch(e) {		
		var idv4 = uuid.v4();
		var uname = ("rpi-"+os.cpus()[0].model+"-at-"+os.cpus()[0].speed).replace(/[\(\)]/g,'').replace(/[^a-zA-Z0-9\-]/g, '_');
		setting2 = {
			"id":idv4,
			"configuration": "",
			"update":{
				"url":"http://mythingbox.io/api/ttbupdate/jessie/getlastversion",
				"type":uname
			},
			"CGUReaded":"false",
			"AccountCreated":"false",
			"AccountLater":"false"
		};	
		createSettings(settings_folder2,settings_filename2,setting2);
	}
	settings = {};
	for (var i in setting1){
		settings[i] = setting1[i];
	}
	for (var i2 in setting2){
		settings[i2] = setting2[i2];
	}
	return settings;
}

function createRSAKey(certs_folder) {
	try{
		var statsCertFolder = fs.lstatSync(certs_folder);
		var statsCertPubFile, statsCertPrivFile;
		if(statsCertFolder.isDirectory()){
			statsCertPrivFile = fs.lstatSync(certs_folder+"/my-ttb.key.pem");
			statsCertPubFile = fs.lstatSync(certs_folder+"/my-ttb.pub");
			if(statsCertPrivFile.isFile() && statsCertPubFile.isFile()){
				return;
			}
		}
	}	
	catch(e) {
		mkdirp(certs_folder, function(err) {
			cp.exec('openssl genrsa -out '+certs_folder+'/my-ttb.key.pem 2048', function(err, stdout, stderr) {
				cp.exec('openssl rsa -in '+certs_folder+'/my-ttb.key.pem -pubout -out '+certs_folder+'/my-ttb.pub', function(err, stdout, stderr) {
					return;				
				});
			});						
		});
	}
}

function createSettings(folder,filename,content){
	mkdirp(folder, function(err) {
		if (err){
			console.log(err);
		}
		else{
			writeSettings(content,filename);
		}
	});
}

function writeSettings(content,filename){
	if (filename){
		fs.writeFile(filename, JSON.stringify(content), {encoding: 'utf8', flag: 'w'}, function(err) {
			if (err)
				console.log(err);			
		});
	} else if (content){
		try{
			content = JSON.parse(content);
		} catch(e){}
		var filtreSettings = {}
		for (var i in content){
			if (content.hasOwnProperty(i) && alllowSettings.indexOf(i) != -1){
				filtreSettings[i]= content[i];
			}
		}
		writeSettings(filtreSettings,settings_filename);
	}
}

function getIp() {
	var ifaces = os.networkInterfaces();
	var eth = ifaces['eth0'];
	var ip;
	if(eth != null) {
		ip = eth[0].address;
	}
	else {
		ip = ifaces['wlan0'][0].address;
	}
	return ip;
}

function getHostname() {
	var hostname = os.hostname();
	return hostname;
}


module.exports = {
	loadSettings:loadSettings
	,writeSettings:writeSettings
	,getHostname:getHostname
	,getIp:getIp
}
