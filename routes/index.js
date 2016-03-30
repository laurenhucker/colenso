var express = require('express');
var basex = require('basex');
var fs = require('fs');
var router = express.Router();
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");


var tei = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0'; ";

client.execute("OPEN Colenso");
client.execute("DELETE file.xml");

function removeTagsFromString(string){
	var regex = /(<([^>]+)>)/ig
	,   body = string
	,   result = body.replace(regex, "|");
	return result;
}

function toArray(string){
	var arr = string.split('|');
	var resultArray = [];
	for(var i = 0; i < arr.length; i++){
		if(arr[i] !== '|'){
			resultArray[resultArray.length] = arr[i];
		}
	}
	return resultArray;
}

function resultsToString(arr){
	var str = '';
	for(var i = 0; i < arr.length; i++){
		str+=arr[i];
	}
	return str;
}

function removeDuplicateEntries(arr){
	var result = [];
	for(var i = 0; i < arr.length; i++){
		if(result.indexOf(arr[i]) === -1){
			result.push(arr[i]);
		}
	}
	return result;
}

function addDivTags(arr){
	var resultArr = [];
	var count = 'A';
	for(var i = 0; i < arr.length; i++){
		if(arr[i].length > 2){
			var newTag = '<div class="list' + count +'">' + arr[i] + '</div>';
			//alternate div class for css purposes
			if(count === 'A') count = 'B';
			else count = 'A';
			resultArr.push(newTag);
		}
	}
	return resultArr;
}


/* GET home page. */
router.get('/', function(req, res) {
	client.execute("OPEN Colenso");
	var url = req.protocol  + '://' + req.get('host') + req.originalUrl;
	console.log(req.get('host'));
	client.execute(tei + "for $n in //title" + " return db:path($n)",
	function(error, result) {
		if(error) { 
			console.error(error);
		} else {
			if(result.result === ''){
				console.log('No Results');
			}
			var content = result.result;
			content = content.split('\n');
			res.render('index', { title: 'Colenso', results: content, url: url});
		}
	});
});

router.get('/authors', function(req, res) {
	client.execute(tei + "//author//name[@type='person']",
		function(error, result) {
			if(error) {
				console.error(error);
			} else {
				if(result.result === ''){
					console.log('No Results');
				}
				 var content = removeTagsFromString(result.result);
				 content = toArray(content);
				 content = resultsToString(content);
				 content = content.split('\r\n');
				 content = removeDuplicateEntries(content);
				 content = content.sort();
				res.render('authors', { title: 'Authors', authors: content, file: '',
					numResults: content.length});
			}
		});
});

router.get('/places', function(req, res) {
	client.execute(tei + "//name[@type='place']",
		function(error, result) {
			if(error) {
				console.error(error);
			} else {
				if(result.result === ''){
					console.log('No Results');
				}
				var content = removeTagsFromString(result.result);
				content = toArray(content);
				content = resultsToString(content);
				content = content.split('\r\n');
				content = removeDuplicateEntries(content);
				content = content.sort();
				res.render('places', { title: 'places', places: content, file: '',
					numResults: content.length});
			}
		});
});

router.get("/stringSearch", function(req, res){
	var url = req.protocol  + '://' + req.get('host') + req.originalUrl;
	var search = req.query.searchString;

	function convertLogicStatementsToXQuery(str) {
		var arr = str.split(' ');
		while (arr.indexOf('and') != -1)
			if (arr.indexOf('and') != -1) arr[arr.indexOf('and')] = 'ftand';
		while (arr.indexOf('or') != -1)
			if (arr.indexOf('or') != -1) arr[arr.indexOf('or')] = 'ftor';
		while (arr.indexOf('not') != -1)
			if (arr.indexOf('not') != -1) arr[arr.indexOf('not')] = 'ftnot';

		return arr;
	}
	function formatSearchInputToXQuery(arr){
		var q = "'";
		for(var i = 0; i < arr.length; i++){
			if(arr[i] != 'ftand' && arr[i] != 'ftor' && arr[i] != 'ftnot') {
				q +=  arr[i] + " ";
			} else {
				q += "'" + arr[i] + "'";
			}
		}
		q += "'";

		//remove unwanted quotes for not
		for(var j = 0; j < q.length -1; j++){
			var x, y, z = ' ';
			if(q.substring(j, j+2) === "''"){
				x = q.substring(0,j);
				y = q.substring(j+2, q.length);
				z = x + " " + y;
				console.log(z);
				q = z;
			}
		}

		console.log(q);
		return q;
	}

	if(search === undefined){
		res.render('stringSearch', {results: [], searchString: '', numResults: ''});
	} else {
		//var query = search;
		var query = formatSearchInputToXQuery(convertLogicStatementsToXQuery(search));
		//query = "'william 'ftnot' colenso'";

		client.execute((tei + "for $n in .//TEI[ . contains text " + query + "]" + " return db:path($n)"),
			function (error, result) {
				if (error) {
					console.error(error);
				} else {
					var content = result.result.split('\n');
					if(content[0] === "") content = [];
					res.render('stringSearch', {
						results: content, searchString: 'Search results for ' + search,
						numResults: content.length + ' results found', url: url
					});
				}
			});
	}
});

router.get("/xQuerySearch", function(req, res){
	var url = req.protocol  + '://' + req.get('host') + req.originalUrl;
	var search = req.query.searchString;
	if(search === undefined){
		res.render('xQuerySearch', {results: [], searchString: '', numResults: ''});
	} else {
		client.execute((tei + "for $n in " + search + " return db:path($n)"),
			function (error, result) {
				if (error) {
					res.render('xQuerySearch', {
						results: '', searchString: 'Search results for ' + search + '   Error: ' + error
					});
					console.error(error);
				} else {
					var content = result.result.split('\n');
					if(content[0] === "") content = [];
					res.render('xQuerySearch', {
						results: content, searchString: 'Search results for ' + search,
						numResults: content.length + ' results found', url:url
					});
				}
			});
	}
});

router.get("/viewFile",function(req,res){
	client.execute(tei + "(doc('Colenso/"+req.query.file+"'))[1]",
		function (error, result) {
			if(error){
				console.error(error);
			}
			else {
				res.render('viewFile', { file: result.result, path: req.query.file});
			}
		});
});

router.get("/saveXml", function(req, res){
	//console.log(req.query.file);
	var content = '';
	client.execute(tei + "(doc('Colenso" + req.query.file + "'))[1]",
		function(error, result){
			if(error){
				console.error(error);
			} else {
				content = result.result;


				var file = getFilePath(req.query.file);
				console.log(file.filepath);
				console.log(file.filename);
					fs.writeFile(file.filepath + file.filename, content, {flags: 'w'}, function(error, result){
						if(error){
							console.error(error);
						} else {
							console.log('Saved');
							res.render('viewFile', { file: content, path: req.query.file,
								saved: 'Saved to ' + file.pretty + file.filename});
						}
					});
			}
		});
});

router.get("/deleteXml", function(req, res){
	var filePath = __dirname + '/../Colenso_TEI' + req.query.file;
	console.log(filePath);
	client.execute("DELETE " + filePath, function(error, result){
		if(error){
			console.error(error);
		} else {
			res.render('viewFile', {
				file: '', path: req.query.file,
				saved: 'Deleted file'
			});
		}
	});
});

function getFilePath(str){
	var arr = str.split('/');
	var path = __dirname + '/../savedXML';
	for(var i = 0; i < arr.length - 1; i++){
		path += arr[i] + '/';
		if(!fs.existsSync(path)){
			fs.mkdirSync(path);
		}
	}

	//pretty path name
	var prettyPathArr = path.split('routes/..');
	prettyPathArr = path.split('routes/..');
	var prettyPath = '';
	for(var j = 0; j < prettyPathArr.length; j++){
		prettyPath += prettyPathArr[j];
	}
	console.log(prettyPath);
	return {filepath: path, filename: arr[arr.length-1], pretty: prettyPath};
}

router.get("/results", function(req, res){
	console.log('place', req.query.place + ' author', req.query.author);
	var searchQuery = '';
	if(req.query.place != undefined){
		console.log('place: ', req.query.place);
		searchQuery = "for $n in //name[@type='place' and . = '" + req.query.place + "'] return db:path($n)";
	}
	if(req.query.author != undefined){
		console.log('Author: ',req.query.author);
		searchQuery = "for $n in //author//name[@type='person' and . = '" + req.query.author + "'] return db:path($n)";
	}
	console.log('searchquery', searchQuery);
	client.execute(tei + searchQuery,
		function(error, result) {
			if(error) {
				console.error(error);
			} else {
				if(result.result === ''){
					console.log('No Results');
				}
				var content = result.result;
				content = content.split('\n');

				res.render('results', {author: req.query.place, results: content, numResults: content.length + ' results found' });
			}
		});
});

router.get("/addFile", function(req, res){
	res.render('addFile');

});

router.get("/add", function(req, res){
	console.log(req.query.filepath);
	client.execute("ADD " + req.query.filepath, function(error, result){
		if(error) {
			console.error(error);
			res.render('addFile', {error: error});
		} else {
			console.log('added file to database');
			var fname = req.query.filepath.split('/').pop();
			client.execute(tei + "('" + fname + "')[1]",
				function (error1, result1) {
					if (error1) {
						console.error(error1);
					} else {

						res.render('addFile', {added: 'Added ' + result1.result});
					}
				});
		}
	});
});

module.exports = router;
