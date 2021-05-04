---
layout: post
title:  "Simple Schedule Using Javascript"
date:   2015-11-17 12:00:00
categories: schedule javascript
excerpt: "<p>In this article we are going to use JavaScript to access the Cablecast API and build a simple schedule. We are going to use the jQuery and Moment.js libraries to make working with ajax and dates a bit easier. This example could be completed without these libraries, but we want to focus on the Cablecast API, not the quirks of programming in JavaScript.</p>"
---
<h3>Introduction</h3>
<p>
In this article we are going to use JavaScript to access the Cablecast API and build a simple schedule. We are going to use the jQuery and Moment.js libraries to make working with ajax and dates a bit easier. This example could be completed without these libraries, but we want to focus on the Cablecast API, not the quirks of programming in JavaScript.
</p>

<p>
We will be using a <code>GET</code> request to the <code>ScheduleItems</code> end point to retrieve our schedule. The documentation for this endpoint can be found <a href="http://tighty.tv/CablecastAPI/documentation/Api/GET-v1-scheduleitems_start_end_show_channel_page_size_offset_include_deleted_sort_order_include_since">here</a>. In the documentation you'll see a number of parameters that can be used to restrict the results. For this example we are interested in <code>channel</code> which will allow us to filter limit the results to a specific channel, <code>start</code> which will allow us to specify when we want our results to begin, <code>end</code> which allows us to specify when our results will end, and <code>include</code> which lets us load additional records associated with the ScheduleItems we are requesting.
</p>

<h3>Basic Document Structure</h3>

<p>
Our document will need jQuery and Moment.js loaded. We also need a JavaScript file where we can put the code we are about to write. Finally, a <code>div</code> tag is needed somewhere in the <code>body</code> with the class <code>js-schedule</code>. This is where will place our schedule after completing the Cablecast API call. You're html file should look something like the example below.
</p>

{% highlight html %}
<!DOCTYPE html>
<html>
<head>
<script src="https://code.jquery.com/jquery-1.11.3.js"></script>
<script src="https://cdn.jsdelivr.net/momentjs/2.10.6/moment-with-locales.min.js"></script>
<script src="schedule.js"></script>
  <meta charset="utf-8">
  <title>Simple Cablecast Schedule</title>
</head>
<body>
  <h1>Schedule</h1>
  <!-- A placeholder for our schedule data. The user will see this while the data loads. -->
  <div class="js-schedule">Loading...</div>
</body>
</html>
{% endhighlight %}

<h3>Getting the Channel Id</h3>

<p>
In order to display results for only one channel, we need to tell the Cablecast API what channel we want results for. We do this by providing the <code>channel</code> parameter in the API call. The simplest is to get it from the Address bar when viewing the Schedule in the Cablecast UI. To do this, load the Cablecast Schedule and choose the desired Channel. The Channel Id is in the Address bar after <code>channel=id</code>.
</p>

![Getting the Channel Id]({{images/getting-channel-id.png | prepend: site.baseurl)

<h3>Loading the Schedule Data</h3>

<p>
Now that we have our Channel Id, we need to calculate the values we want to use four our <code>start</code> and <code>end</code> parameters. We will use moment.js to make this easier.
</p>

{% highlight js %}
var today = moment().startOf('day').toDate(); // Midnight today
var tomorrow = moment(today).add(1, 'day').toDate(); // Midnight tomorrow
{% endhighlight %}

<p>
Now we have all the data we need to get our Schedule data from Cablecast. We will perform our Cablecast API call using jQuery's <code>getJSON()</code> method. We can chain the <code>getJSON()</code> call with a <code>then</code> and <code>fail</code> methods. Both methods take callbacks which will be executed if the API call succeeds or fails respectively. In the <code>then()</code> method we will build some markup for our schedule, and then replace the <code>js-schedule</code> div's content with that markup. If the request fails for some reason, the <code>fail</code> method will execute and display an error message.
</p>

{% highlight js %}
  $.getJSON('http://tighty.tv/cablecastapi/v1/scheduleitems', {
    start: today.toISOString(), // The API expects ISO formatted strings
    end: tomorrow.toISOString(),
    channel: 1, // The Id of the Channel that we want the schedule for.
    include: 'show' // Tells the API we also want any Shows the ScheduleItems refer to
  })
  .then(function(data) {
    // This code gets fired if the getJSON call was successful. We'll build a simple table of the schedule results and replace the js-schedule html
    var markup = buildScheduleMarkup(data);
    $('.js-schedule').html(markup);
  })
  .fail(function() {
    $('.js-schedule').html('Error Loading Schedule.');
  });
{% endhighlight %}

<p>
If you're following along your probably getting an error about <code>buildScheduleMarkup</code> not being defined. Lets define that now. <code>buildScheduleMarkup</code> is a simple function that will take the data returned from our API call and build an html <code>table</code> that contains the <code>runDateTime</code> of the ScheduleItem and the <code>cgTitle</code> of the Show. To get the Show referenced by the ScheduleItem we will use the <code>lookupItemById</code> utility function that is also defined below. The <code>ScheduleItem</code> model references the Show record by Id. Because we set the <code>include</code> parameter to <code>show</code> when making the API call, all the shows were also included with the result set. The <code>lookupItemById</code> takes the required Show Id and the collection of Shows and returns the desired Show record.
</p>

{% highlight js %}
// A simple method that builds a html table from the scheduleitems payload
var buildScheduleMarkup = function(payload) {
  var markup = '';
  // Basic Table Construction
  markup += '<table>\n';
  markup += '<thead>\n';
  markup += '<tr><th>Time</th><th>Title</th></tr>\n';
  markup += '</thead>\n';
  markup += '<tbody>\n';

  // Loop through each run and add a row
  payload.scheduleItems.forEach(function(run) {
    if (run.cgExempt) { return; } // Don't display cgExempt runs
    var show = lookupItemById(run.show, payload.shows); // lookup the show in the results
    markup += '<tr><td>' + moment(run.runDateTime).format('hh:mm a') + '</td><td>' + show.cgTitle + '</td></tr>\n';
  });

  // Finish the table
  markup += '</tbody>\n';
  markup += '</table>\n';

  // Return the markup
  return markup;
};

// Utility method to lookup an item in the payload by its id.
var lookupItemById = function(id, items) {
  return items.find(function(element) {
    return element.id === id;
  });
};
{% endhighlight %}

<h3>Putting It All Together</h3>

<p>
The JSBin below shows a working example of the code described above. If you have any problems, please open an <a href="https://github.com/trms/cablecast-api-examples/issues">Issue</a> and let us know.
</p>

<a class="jsbin-embed" href="http://jsbin.com/fefopo/embed?html,js,output">JS Bin on jsbin.com</a><script src="http://static.jsbin.com/js/embed.min.js?3.35.3"></script>

<h3>Additional Resources</h3>

<p>
Need help learning javascript? Check out:
</p>

<ul>
  <li> <a href="https://www.codecademy.com/learn/javascript">https://www.codecademy.com/learn/javascript</a> </li>
  <li> <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">https://developer.mozilla.org/en-US/docs/Web/JavaScript</a> </li>
</ul>
