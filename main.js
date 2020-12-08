// Modified in part from: https://bl.ocks.org/d3noob/06e72deea99e7b4859841f305f63ba85

var units = "Widgets";

// set the dimensions and margins of the graph
var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1600 - margin.left - margin.right,
    height = 1000 - margin.top - margin.bottom;

// format variables
var formatNumber = d3.format(",.0f"),    // zero decimal places
    format = function(d) { return formatNumber(d) + " " + units; },
    color = d3.scaleOrdinal(d3.schemeCategory10);

// append the svg object to the body of the page
var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");


// Set the sankey diagram properties
var sankey = d3.sankey()
    // use .nodeWidth to control size of images
    .nodeWidth(150)
    .nodePadding(20)
    .size([width, height]);

var path = sankey.link();

// load the data - on callback, run the rest of the script
d3.csv("node_csv_for_class.csv", function(error, data) {

  //set up graph in same style as original example but empty
  rows = []
  data.forEach(function (d) {
    // if the data in the table is marked OK to put in the graph
    // load each row as a dictionary
    if (d.display == "yes")
    {
      rows.push({"name":d.name,
               "month": Number(d.month),
               "year": Number(d.year),
               "tag_1": d.tag_1,
               "tag_2": d.tag_2,
               "tag_3": d.tag_3,
               "url": d.url,
               "img": d.img})
    }
  })

  // Initialize data storage
  graph = {"nodes" : [], "links" : []};
  possible_links = [];
  node_info = {};
  link_info = {};
  // Make sure link info is a multidimensional array
  rows.forEach(function (d, i) {
    link_info[rows[i].name] = {};
  });

  // Associate colors with tags and themes in the data
  tag_color = {
    "memory": "#E6B48C",
    "modularity": "#E66AC2",
    "vitality": "#87E677",
    "planarity": "#E68C81",
    "ephemerality":"#6AD4E6"
  }

  // Create legend for tags automatically sized based on number of tags
  // Initialize variables
  var legend_box_width = width/Object.keys(tag_color).length + margin.left;
  legend_keys = [];
  number_tags = tag_color.length;
  legend_height =  height/5;


  // Add an SVG
  var legend = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", legend_height + margin.top + margin.bottom);

  // Populate the legend
  i = 0;
  for(tag in tag_color)
  {
    //Make a new reference point
    var new_box = legend.append("g")
      .attr("class", "node")
      .attr("transform",
            "translate(" + i*legend_box_width + "," + 0 + ")")
    // Assign a rectangle
    new_box.append("rect")
      .style("fill",tag_color[tag])
      .attr("width", legend_box_width)
      .attr("height", legend_height)
    // Assign text
    new_box.append("text")
      .attr("x", legend_box_width/2)
      .attr("y", legend_height/2)
      .style("fill","black")
      .attr("text-anchor", "middle")
      .attr("transform", null)
      .text(tag);
    i++;
  };


  // Find all unique links between projects
  // For each project/node/(source)
  rows.forEach(function (source)
  {
    // Check each project/row (target)
    rows.forEach(function (target)
    {
      // Find the amount of time in months between the referenced projects
      var duration = ( (target.year - source.year) * 12 + target.month - source.month );

      // If it's greater than 0, continue
      // Weeds out reverse relationships and also same projects
      // Also makes sure that projects that occur concurrently aren't linked
      if (duration > 0)
      {
        // Find associated tags for each projects
        source_tags = find_tags(source);
        target_tags = find_tags(target);

        // For each tag associated with the source
        source_tags.forEach(function (tag)
        {
          // If the target project shares the tag and the tag isn't a void value
          if (target_tags.includes(tag) & tag!="")
          {
            // Include the relationship between the two projects as a possible link
            possible_links.push(
            {
              "source":source.name,
              "target":target.name,
              "value": 1
            });

            // The related nodes may also be included in the graph (i.e. nodes with no links may not be included)
            graph.nodes.push(
              {"name":source.name}
            );
            graph.nodes.push(
              {"name":target.name}
            );

            // Populate node info
            node_info[source.name] =
                       {"url": source.url,
                       "img": source.img};
            node_info[target.name] =
                       {"url": target.url,
                       "img": target.img};

            // Populate link info
            link_info[source.name][target.name] =
            {
              "type": tag,
              "duration": duration,
            }
          }
        });
      }
    });
  });

  // Prune the links that attach projects that are already attached indirectly, i.e. through another project
  // For every link
  possible_links.forEach(function (test_link)
  {
    // Initialize test variable
    excluded = false;
    // Check each other link
    possible_links.forEach(function (temp_link)
    {
      // If the two links share the same source
      if (test_link.source == temp_link.source)
      {
        // Retrieve associated info for each link
        source_name = test_link.source;
        test_target_name = test_link.target;
        temp_target_name = temp_link.target;
        test_link_info = link_info[source_name][test_target_name];
        temp_link_info = link_info[source_name][temp_target_name];

        // If the links have the same type
        if (test_link_info.type == temp_link_info.type)
        {
          // If the test link links two projects with more time between them than those of
          // the temp link, the test link cannot be included
          // Because there is a different from the same source of the same type connecting to a closer project chronologically
          // And THAT project will eventually connect to the target of the test link
          // So keeping the test link would lead to too many connections
          if (test_link_info.duration > temp_link_info.duration)
          {
            excluded = true;
          }
        }
      }
    });
    // If it passes the gauntlet, it's a link we want to pursue.
    if (!excluded)
    {
      graph.links.push(test_link);
    }
  });


  // return only the distinct / unique nodes
  // This is what next and key does
  graph.nodes = d3.keys(d3.nest()
    .key(function (d) { return d.name; })
    .object(graph.nodes));

  // loop through each link replacing the text with its index from node
  graph.links.forEach(function (d, i) {
    graph.links[i].source = graph.nodes.indexOf(graph.links[i].source);
    graph.links[i].target = graph.nodes.indexOf(graph.links[i].target);
  });

  // now loop through each nodes to make nodes an array of dictionary objects
  // rather than an array of strings
  graph.nodes.forEach(function (d, i) {
    graph.nodes[i] = { "name": d };
  });

  sankey
      .nodes(graph.nodes)
      .links(graph.links)
      .layout(32);

  // add in the links
  var link = svg.append("g").selectAll(".link")
      .data(graph.links)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", path)
      .style("stroke-width", function(d) { return Math.max(1, d.dy); })
      .sort(function(a, b) { return b.dy - a.dy;})
      // Set link color according to its type
      .style("stroke", function(d) {
        tag = link_info[d.source.name][d.target.name].type;
		    return tag_color[tag];
		  });

  // add the link titles
  link.append("title")
        .text(function(d) {
        tag = link_info[d.source.name][d.target.name].type
    		return d.source.name + " → " +
                d.target.name + "\n" + "Shared theme: " + tag; });

  // add in the node hosts
  var node = svg.append("g").selectAll(".node")
      .data(graph.nodes)
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) {
		  return "translate(" + d.x + "," + d.y + ")"; })

  // Add in border rectangles
  node.append("rect")
    .style("fill", "black")
    .attr("class", "image_border")
    .attr("transform", function(d) {
		  return "translate(" + -1* sankey.nodePadding()/2 + "," + -1*sankey.nodePadding()/2 + ")"; })
    .attr("height", sankey.nodeWidth() + 2*sankey.nodePadding())
    .attr("width", sankey.nodeWidth() + sankey.nodePadding())

  // Add in link to website for when clicked
  node
      .append("svg:a")
      .attr("xlink:href",
        function(d)
          {
            return node_info[d.name].url;
          }
        )
      // Add in image
      .append("svg:image")
      .attr("xlink:href", function(d)
          {
            return "images/" + node_info[d.name].img;
          }
        )
      //set image attribute to node width
      .attr("height", sankey.nodeWidth())
      .attr("width", sankey.nodeWidth())



  // add in the title for the nodes
  node.append("text")
      .attr("x", sankey.nodeWidth()/2)
      .attr("y", sankey.nodeWidth() + sankey.nodePadding()/1.333)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("transform", null)
      .text(function(d) { return d.name; })
});

// returns a list of all tags associated with a given node
find_tags = function(temp_node) {
  tags = [temp_node["tag_1"],temp_node["tag_2"],temp_node["tag_3"]];
  return tags;
};
