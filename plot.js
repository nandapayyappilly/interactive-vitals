const svg = d3.select("svg"),
      width = +svg.attr("width") - 60,
      height = +svg.attr("height") - 60,
      margin = { top: 30, right: 30, bottom: 50, left: 60 };

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

let xScale = d3.scaleLinear().range([0, width]);
let yScale = d3.scaleLinear().range([height, 0]);

const color = d3.scaleOrdinal(d3.schemeTableau10);

const xAxis = g.append("g").attr("transform", `translate(0,${height})`);
const yAxis = g.append("g");

const line = d3.line()
  .x(d => xScale(d.norm_time))
  .y(d => yScale(d.avg));

function updateChart(data, signal, groupby) {
  const nested = d3.groups(data, d => d[groupby]);

  const summarized = nested.map(([key, values]) => {
    const bins = d3.bin()
      .value(d => d.norm_time)
      .thresholds(100)(values);

    const points = bins.map(bin => {
      const avg = d3.mean(bin, d => +d.value);
      return {
        norm_time: d3.mean(bin, d => d.norm_time),
        avg: avg
      };
    });

    return {
      key: key,
      values: points
    };
  });

  const allPoints = summarized.flatMap(d => d.values);
  xScale.domain([0, 1]);
  yScale.domain([d3.min(allPoints, d => d.avg) - 5, d3.max(allPoints, d => d.avg) + 5]);

  xAxis.transition().call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.format(".0%")));
  yAxis.transition().call(d3.axisLeft(yScale));

  const groups = g.selectAll(".line-group")
    .data(summarized, d => d.key);

  groups.exit().remove();

  const newGroups = groups.enter()
    .append("g")
    .attr("class", "line-group");

  newGroups.append("path")
    .attr("class", "line")
    .style("stroke", d => color(d.key));

  groups.merge(newGroups).select(".line")
    .transition()
    .attr("d", d => line(d.values));
}

d3.csv("data/long_surgery_vitals.csv").then(data => {
  data.forEach(d => {
    d.norm_time = +d.norm_time;
    d.value = +d.value;
  });

  const signalSelect = d3.select("#signal");
  const groupSelect = d3.select("#groupby");

  function filteredData() {
    const signal = signalSelect.property("value");
    return data.filter(d => d.signal === signal);
  }

  function refresh() {
    const signal = signalSelect.property("value");
    const groupby = groupSelect.property("value");
    updateChart(filteredData(), signal, groupby);
  }

  signalSelect.on("change", refresh);
  groupSelect.on("change", refresh);

  refresh();
});