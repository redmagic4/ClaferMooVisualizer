/*
Copyright (C) 2012, 2013 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
function Input(host)
{ 
    this.id = "mdInput";
    this.title = "Input File or Example";
    this.host = host;

    this.requestTimeout = 60000; // what is the timeout for response after sending a file, &line timeout
    this.pollingTimeout = 60000;  // what is the timeout when polling, &line [polling, timeout]
    this.pollingDelay = 2000;    // how often to send requests (poll) for updates, &line polling

    this.width = 500;
    this.height = 88;
    this.posx = 0;
    this.posy = 0;
    
    this.pollingTimeoutObject = null;//&line [polling, timeout]
    this.toCancel = false;//&line cancellation
    
    this.serverAction = "/upload";
    
    this.dataFileChosen = false;
}

Input.method("onDataLoaded", function(data){
    this.processor = new ClaferProcessor(data.claferXML);
    this.goals = this.processor.getGoals();
});

Input.method("onInitRendered", function()
{
    this.optimizeFlag = 1;
    this.addInstancesFlag = 1;
    this.previousData = null;
    this.toCancel = false;//&line cancellation

    $("#submitFile").click(this.submitFileCall.bind(this));//&line selectionOfExamples
    $("#submitExample").click(this.submitExampleCall.bind(this));//&line selectionOfExamples
    
    $("#submitExample").attr("disabled", "disabled");//&line selectionOfExamples
    $("#submitFile").attr("disabled", "disabled");//&line selectionOfExamples
    
    $("#myform [type='file']").change(this.inputChange.bind(this));
    $("#exampleURL").change(this.exampleChange.bind(this));
    
    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.fileSent.bind(this);//&line polling
    options.error = this.handleError.bind(this);//&line errorHandling
    options.timeout = this.requestTimeout;// &line timeout

    $('#myform').ajaxForm(options); 
//	$('#myform').submit(); moved submit out of here, because the backend list is not loaded yet
});
/*
 * Cancel request
 */
//$begin cancellation
Input.method("cancelCall", function() 
{
    $("#cancel").hide();
    $("#status_label").html("Cancelling...");
    this.toCancel = true;
});
//$end cancellation
/*
 * Shows uploader and hides the form
*/
Input.method("beginQuery", function(formData, jqForm, options) {
	$("#load_area #myform").hide();
	$("#load_area").append('<div id="preloader"><img id="preloader_img" src="/images/preloader.gif" alt="Loading..."/><span id="status_label">Loading and processing...</span><button id="cancel">Cancel</button></div>');	
    $("#cancel").click(this.cancelCall.bind(this));//&line cancellation
    return true; 
});

// post-submit callback 
Input.method("endQuery", function()  { 
	$("#preloader").remove();
	$("#load_area #myform").show();
	
	return true;
});

/* Not used. We don't need it anymore
// pre-submit callback 
Input.method("showRequest", function(formData, jqForm, options) {
    var queryString = $.param(formData); 
    return true; 
});
*/

//&begin polling
Input.method("onPoll", function(responseObject)
{
    if (responseObject.message === "Working")
    {
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);//&line timeout
    }//&begin cancellation
    else if (responseObject.message === "Cancelled")
    {
        this.endQuery();
    }//&end cancellation
    else
    {
        this.processToolResult(responseObject);
        this.endQuery();
    }
});        

Input.method("poll", function()
{
    var options = new Object();
    options.url = "/poll";
    options.type = "post";
    options.timeout = this.pollingTimeout;//&line timeout
    if (!this.toCancel)
        options.data = {windowKey: this.host.key, command: "ping"};
    else
        options.data = {windowKey: this.host.key, command: "cancel"};//&line cancellation
    
    options.success = this.onPoll.bind(this);
    options.error = this.handleError.bind(this);
    
    $.ajax(options);
});
//&begin claferModel
Input.method("setClaferModelHTML", function(html){
    this.host.findModule("mdClaferModel").model = html;
    var iframe = $("#model")[0];
    iframe.src = iframe.src; // reloads the window
});
//&end claferModel
Input.method("fileSent", function(responseText, statusText, xhr, $form)  { 
    this.toCancel = false;

    if (responseText == "compile_error")
    {
        this.handleError(null, "compile_error", null);
        this.endQuery();
        return;
    }

    if (responseText != "no clafer file submitted")
    {
        if (responseText != "OK")
        {
            this.setClaferModelHTML(responseText);//&line claferModel
        }
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
    }
    else
        this.endQuery();
});
//&end polling
//&begin errorHandling
Input.method("handleError", function(response, statusText, xhr)  { 
	clearTimeout(this.pollingTimeoutObject);
	var er = document.getElementById("error_overlay");
	er.style.visibility = "visible";	
    var caption;

    if (statusText == "compile_error")
        caption = "<b>Compile Error.</b><br>Please check whether Clafer Compiler is available, and the model is correct.";
    else if (statusText == "timeout")//&line timeout
        caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";//&line timeout
    else if (statusText == "malformed_output")
        caption = "<b>Malformed output received from ClaferMoo.</b><br>Please check whether you are using the correct version of ClaferMoo. Also, an unhandled exception is possible.  Please verify your input file: check syntax and integer ranges.";        
    else if (statusText == "malformed_instance")
        caption = "<b>Malformed instance data received from ClaferMoo.</b><br>An unhandled exception may have occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.";        
    else if (statusText == "empty_instances")
        caption = "<b>No instances returned.</b>Possible reasons:<br><ul><li>No optimal instances, all variants are non-optimal.</li><li>An unhandled exception occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.</li></ul>.";        
    else if (statusText == "empty_argument")
        caption = "<b>Empty argument given to processToolResult.</b><br>Please report this error.";        
    else if (statusText == "empty_instance_file")
        caption = "<b>No instances found in the specified file.";        
    else if (statusText == "optimize_first")
        caption = "<b>You have to run optimization first, and only then add instances.";        
    else if (statusText == "error" && response.responseText == "")
        caption = "<b>Request Error.</b><br>Please check whether the server is available.";        
    else
        caption = '<b>' + xhr + '</b><br>' + response.responseText.replace("\n", "<br>");
    
	document.getElementById("error_report").innerHTML = ('<span id="close_error" alt="close">Close Message</span><p>' + caption + "</p>");
	document.getElementById("close_error").onclick = function(){ 
		document.getElementById("error_overlay").style.visibility = "hidden";
	};
	this.endQuery();
    
});
//&end errorHandling
Input.method("convertHtmlTags", function(input) {
  var in_tag=false;
  var in_var=false;
  var output = new String("");

  var length = input.length;
  
  for (var i=0; i< length; i++) 
    {
      ch = input.charAt(i);
	  
      if (in_tag) 
	  {
		if (in_var) 
		{
			if (ch == '"') 
			{
				in_var = false;
			}
			
			output += ch;
		}
		else 
		{
			if (ch == '"') 
			{
				in_var = true;
			}
			else if (ch == '>') 
			{
				in_tag = false;
			}
			
			output += ch.toLowerCase();
		}
      }
      else 
	  {
		if (ch == '<') 
		{
			in_tag = true;
		}
		output += ch;
      }
    }

  return output;
});
//&begin selectionOfExamples
Input.method("submitFileCall", function(){

    $("#exampleURL").val(null);
    $("#exampleFlag").val("0");
    
    if (this.dataFileChosen)
    {
       	this.optimizeFlag = 0;
        this.addInstancesFlag = 1;
    }
    else 
    {
        this.optimizeFlag = 1;
        this.addInstancesFlag = 0;
        this.previousData = null;
        host.findModule("mdComparisonTable").permaHidden = {};
    }
});

Input.method("submitExampleCall", function(){
    this.optimizeFlag = 1;
    this.addInstancesFlag = 0;
    this.previousData = null;
    
    $("#exampleFlag").val("1");
    
    host.findModule("mdComparisonTable").permaHidden = {};
});
Input.method("exampleChange", function(){
    if ($("#exampleURL").val())
    {
        $("#submitExample").removeAttr("disabled");
    }
    else
    {
 		$("#submitExample").attr("disabled", "disabled");       
    }
});
//&end selectionOfExamples
Input.method("inputChange", function(){
	var filename = $("#myform [type='file']").val();
    
    if (filename)
    {
        if (filename.substring(filename.length-4) == ".cfr"){
            $("#submitFile").val("Optimize");
            $("#submitFile").removeAttr("disabled");                      
            this.dataFileChosen = false;
        } else if (filename.substring(filename.length-5) == ".data"){
            $("#submitFile").val("Add Instances");
            $("#submitFile").removeAttr("disabled");             
            this.dataFileChosen = true;
        }
        else{ // unknown file
            $("#submitFile").val("Unknown File");
            $("#submitFile").attr("disabled", "disabled");       
            this.dataFileChosen = false;
        }
    }
    else{ // no file
        $("#submitFile").val("Optimize");
        $("#submitFile").attr("disabled", "disabled");       
        this.dataFileChosen = false;
    }
    
});
//&begin instanceProcessing
Input.method("processToolResult", function(result)
{//&begin errorHandling
	if (!result)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }
	//&end errorHandling
//    var resultData = JSON.parse(result);
    
//    resultData.message = unescapeJSON(resultData.message);

//    resultData.claferXML = resultData.claferXML;
//    resultData.instances = resultData.instances;
//    resultData.message = resultData.message;
	
	var instances = result.instances;
	var abstractXMLText = result.claferXML;

	if (this.optimizeFlag){
		this.optimizeFlag = 0;
    	this.addInstancesFlag = 0;
	//&begin errorHandling
    	if (!result.instances)
		{
            this.handleError(null, "malformed_output", null);
       		return;
   		}//&end errorHandling
    } else if (this.addInstancesFlag) {
        
		this.optimizeFlag = 0;
    	this.addInstancesFlag = 0;

        if (this.previousData)
        {
            instances = this.previousData.Unparsed;

            if (!result.instances)            
            {
                this.handleError(null, "empty_instance_file", null);
                return;
            }
            
            var parser = new InstanceConverter(result.instances);
            instances += parser.convertFromClaferIGOutputToClaferMoo(this.previousData.abstractXML);            
            abstractXMLText = this.previousData.abstractXML;
        }
        else//&begin errorHandling
		{
            this.handleError(null, "optimize_first", null);
       		return;
   		}//&end errorHandling
	}

	var instancesXMLText = (new InstanceConverter(instances)).convertFromClaferMooOutputToXML();

	instancesXMLText = instancesXMLText.replaceAll('<?xml version="1.0"?>', '');
	//&begin errorHandling
    if (instancesXMLText.length == 0 || instancesXMLText == "<instances></instances>")
    {
        this.handleError(null, "empty_instances", null);
        return;
    }//&end errorHandling
    //&begin errorHandling
    if (instancesXMLText.indexOf("<instance></instance>") >= 0)
	{
        this.handleError(null, "malformed_instance", null);
        return;
    }//&end errorHandling

    
//	abstractXMLText = abstractXMLText.replaceAll("&quot;", "\"");
//	abstractXMLText = abstractXMLText.replaceAll("&gt;", ">");
//	abstractXMLText = abstractXMLText.replaceAll("&lt;", "<");
//	abstractXMLText = abstractXMLText.replaceAll("&amp;", "&");
	
	abstractXMLText = this.convertHtmlTags(abstractXMLText);
		
	// clean namespaces
	abstractXMLText = abstractXMLText.replaceAll('<?xml version="1.0"?>', '');
	abstractXMLText = abstractXMLText.replaceAll(' xmlns="http://clafer.org/ir" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:cl="http://clafer.org/ir" xsi:schemalocation="http://clafer.org/ir https://github.com/gsdlab/clafer/blob/master/src/ClaferIR.xsd"', '');
	abstractXMLText = abstractXMLText.replaceAll('cl:', '');
	abstractXMLText = abstractXMLText.replaceAll('xsi:', '');

    var data = new Object();
    data.error = false;
    data.output = result.message;
    data.instancesXML = instancesXMLText;
    data.claferXML = abstractXMLText;
    
    if (!this.previousData){
    	var lines = result.instances.match(/^.*([\n\r]+|$)/gm);
    	lines = result.instances.split(lines[1]);
    	this.originalPoints = lines.length - 1;
    }
    data.originalPoints = this.originalPoints;
    this.previousData = { Unparsed: instances, abstractXML: data.claferXML };
    this.host.updateData(data);
});//&end instanceProcessing

Input.method("getInitContent", function()
{
    result = '<div id = "load_area">';
    result += '<form id="myform" action="' + this.serverAction + '" method="post" enctype="multipart/form-data" style="display: block;">';
    result += '<fieldset>';
    result += '<input type="file" size="25" name="claferFile" id="claferFile" style="width: 388px;">';
    result += '<input type="hidden" name="claferFileURL" value="' + window.location + '">';
    result += '<input type="hidden" name="exampleFlag" id="exampleFlag" value="0">';
    result += '<input id="submitFile" type="submit" value="Optimize">';

    result += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';//&line windowKey
    result += '<br>';
	//&begin selectionOfExamples
    result += '<select id="exampleURL" name="exampleURL" style="width: 388px;">';   

    $.getJSON('/Examples/examples.json', 
        function(data)
        {
            var examples = data.examples;
            var options = "";
        
            for (var i = 0; i < examples.length; i++)
            {
                var optionClass = 'normal_option';

                if (i == 0)
                    optionClass = 'first_option';

                options += '<option class="' + optionClass + '" value="' + examples[i].url + '">' + examples[i].label + '</option>';
            }
            
            $("#exampleURL").html(options);

        }
    ).error(function() 
        { 
            var optionClass = 'first_option';
            var options = '<option class="' + optionClass + '" value="">Or Choose Example (Could not load examples)</option>';
            $("#exampleURL").html(options);
            
        });
    
    result += '</select>';
    result += '<input id="submitExample" type="submit" value="Optimize"></input>';
	//&end selectionOfExamples
    result += '</fieldset><div style="height:8px">&nbsp;</div>';

    result += '<span>Backend:</span><select id="backend" name="backend" style="width: 288px;">';   
    
    $.getJSON('/Backends/backends.json', 
        function(data)
        {
            var backends = data.backends;
            var options = "";
        
            for (var i = 0; i < backends.length; i++)
            {
                options += '<option value="' + backends[i].id + '">' + backends[i].label + '</option>';
            }
            
            $("#backend").html(options);
            $('#myform').submit(); // make the submit here            
        }
    ).error(function() 
        { 
            var options = '<option value="">(Could not load backends)</option>';
            $("#backend").html(options);            
        });
    
    result += '</select>';
    result += '<input type="checkbox" name="cache" checked="checked"/>Use Cache';   //&line cache
    result += '</form></div>';
    
    return result;
// id="addInstances"    
  
});


function unescapeJSON(escaped) 
{
    return escaped
        .replaceAll('\\\\', '\\')
        .replaceAll('\\"', '"')
        .replaceAll('\\/', '/')
        .replaceAll('\\b', '\b')
        .replaceAll('\\f', '\f')
        .replaceAll('\\n', '\n')
        .replaceAll('\\r', '\r')
        .replaceAll('\\t', '\t');                  
}
