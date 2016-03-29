var express = require('express');
var basex = require('basex');
var fs = require('fs');
var router = express.Router();
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");


var tei = "XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0'; ";

client.execute("OPEN Colenso");

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

function replaceAllTagsWithDiv(str){
	return addDivTags(removeTagsFromString(str).split('|'));
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
			res.render('index', { title: 'Colenso', results: content});
		}
	});
});

router.get('/authors', function(req, res) {
	client.execute(tei + "//name[@type='person']",
		function(error, result) {
			if(error) {
				console.error(error);
			} else {
				if(result.result === ''){
					console.log('No Results');
				}

				// var content = removeTagsFromString(result.result);
				// content = toArray(content);
				var content = result.result.split('\n');
				content = removeDuplicateEntries(content);
				content = content.sort();
				// content = addDivTags(content);
				// content = resultsToString(content);

				res.render('authors', { title: 'Authors', places: content, file: ''});
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
				console.log(result.result)
				// var content = removeTagsFromString(result.result);
				// content = toArray(content);
				// content = removeDuplicateEntries(content);
				// content.sort();
				// content = addDivTags(content);
				// content = resultsToString(content);
				res.render('places', { title: 'Places', places: result.result.split('\n'), file: ''});
			}
		});
});



router.get("/stringSearch", function(req, res){
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
			var x, y, z = '';
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
		res.render('stringSearch', {results: [], searchQuery: '', numResults: ''});
	} else {
		//var query = search;
		var query = formatSearchInputToXQuery(convertLogicStatementsToXQuery(search));

		client.execute((tei + "for $n in .//TEI[ . contains text " + query + "]" + " return db:path($n)"),
			function (error, result) {
				if (error) {
					console.error(error);
				} else {
					var content = result.result.split('\n');
					if(content[0] === "") content = [];

					console.log(content);
					res.render('stringSearch', {
						results: content, searchString: 'Search results for ' + search,
						numResults: content.length + ' results found'
					});
				}
			});
	}
});

router.get("/xQuerySearch", function(req, res){
	var search = req.query.searchQuery;
	if(search === undefined){
		res.render('xQuerySearch', {results: [], searchQuery: '', numResults: ''});
	} else {
		client.execute((tei + "for $n in " + search + " return db:path($n)"),
			function (error, result) {
				if (error) {
					console.error(error);
				} else {
					var content = result.result.split('\n');
					if(content[0] === "") content = [];
					res.render('xQuerySearch', {
						results: content, searchQuery: 'Search results for ' + search,
						numResults: content.length + ' results found'
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
	console.log(req.query.file);
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
							res.render('viewFile', { file: content, path: req.query.file, saved: 'Saved'});
						}
					});
			}
		});
});

function getFilePath(str){
	var arr = str.split('/');
	var path = __dirname + '/../savedXML/';
	for(var i = 0; i < arr.length - 1; i++){
		path += arr[i] + '/';
		if(!fs.existsSync(path)){
			fs.mkdirSync(path);
		}
	}
	return {filepath: path, filename: arr[arr.length-1]};
}

router.get("/results", function(req, res){
	var searchQuery = toArray(removeTagsFromString(req.query.place));
	console.log(req.query.place);
	client.execute(tei + "for $n in .//TEI[ . contains text " + searchQuery + "]" + " return db:path($n)",
		function(error, result) {
			if(error) {
				console.error(error);
			} else {
				if(result.result === ''){
					console.log('No Results');
				}
				var content = result.result;
				content = content.split('\n');
				console.log(content);

				res.render('index', { title: 'Colenso', results: content});
			}
		});
});

module.exports = router;
