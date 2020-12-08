// In turn, it seems this code was modified from the d3 standard base code: https://github.com/d3/d3-sankey/blob/master/src/sankey.js
// Most work on this portion went into understanding what was going on


d3.sankey = function() {
  // Initialize defaults
  var sankey = {},
      nodeWidth = 50,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [];

  // Sets nodewidth if function has an argument; otherwise returns the current setting
  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  // Sets nodePadding if function has an argument; otherwise returns the current setting
  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  // Sets nodes if function has an argument; otherwise returns the current setting
  sankey.nodes = function(_) {
    if (!arguments.length){
      return nodes;
    }
    nodes = _;
    return sankey;
  };

  // Sets links if function has an argument; otherwise returns the current setting
  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  // Sets size if function has an argument; otherwise returns the current setting
  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  // Creates layout
  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };

  // FROM THE SOURCE CODE, commented to demonstrate understanding and modified to fit my graphical needs
  // Controls the shape of the curves connecting nodes
  sankey.link = function() {
    // The higher this number, the greater the curvature of the links/paths
    var curvature = .6;

    function link(d) {
      //set start x and end x. find a mid point x value. using curvature parameter, offset that value.
      //Use the resulting value to determine two control points
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y+nodeWidth/2,
          y1 = d.target.y+nodeWidth/2;
      // return curve parameter based on control points
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // FROM THE SOURCE CODE, commented to demonstrate understanding
  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    // For each link (taken from the code in main.js)
    links.forEach(function(link) {
      // Initialize some variables
      var source = link.source,
          target = link.target;

      // Error check
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];

      // Set the source links from the old links
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // The larger each node is, the smaller the lines connecting them (path size determined by link weight relative to node size)
  // I have played with this from the original code
  // Originally node values were supposed to be variable. None of that - only single-width lines here.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = 30;
    });
  }
  // FROM THE SOURCE CODE, UNALTERED
  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.

  // FROM HERE, COMMENTED TO DEMONSTRATE UNDERSTANDING
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    // while still nodes left
    while (remainingNodes.length) {

      nextNodes = [];
      // for each remaining node
      remainingNodes.forEach(function(node) {
        // set the x value
        node.x = x;

        // set the rate at which x changes
        node.dx = nodeWidth;

        node.sourceLinks.forEach(function(link) {
          // if target node would be behind this node, move it forward
          if (nextNodes.indexOf(link.target) < 0) {
            nextNodes.push(link.target);
          }
        });
      });
      // iterate
      remainingNodes = nextNodes;
      ++x;
    }

    //
    //move target locations to the right, now that the row to the left has been altered
    moveSinksRight(x);
    // change node breath sizes for the number of links left to allocate
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  //changes the x depth for each node based on k
  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    // group nodes based on their relative x positions
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });
      //initialize node y values much in the same way as the xs, only based on how many nodes there are in an x sink
      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          // can change
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      //weight y values based on where other nodes are
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      // Sets adjustment values for y
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
};
