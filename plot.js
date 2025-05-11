const margin = { top: 50, right: 40, bottom: 50, left: 60 },
      width = 900 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

const svg = d3.select("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

const xAxis = d3.axisBottom(x).tickFormat(d3.format(".0%"));
const yAxis = d3.axisLeft(y);

svg.append("g").attr("transform", `translate(0,${height})`).attr("class", "x-axis");
svg.append("g").attr("class", "y-axis");

const line = d3.line()
    .x(d => x(d.norm_time))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

const area = d3.area()
    .x(d => x(d.norm_time))
    .y0(d => y(d.mean - d.sd))
    .y1(d => y(d.mean + d.sd))
    .curve(d3.curveMonotoneX);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const vitalSelect = d3.select("body").insert("select", ":first-child").attr("id", "vitalSelect");
const groupSelect = d3.select("body").insert("select", ":first-child").attr("id", "groupSelect");

d3.csv("cleaned_surgery_long.csv", d3.autoType).then(data => {
  const vitals = [...new Set(data.map(d => d.signal))];
  const groups = ["optype", "emop"];

  vitalSelect.selectAll("option")
    .data(vitals).enter().append("option")
    .text(d => d).attr("value", d => d);

  groupSelect.selectAll("option")
    .data(groups).enter().append("option")
    .text(d => d === "optype" ? "Surgery Type" : "Emergency Status").attr("value", d => d);

  function updateChart() {
    const selectedVital = vitalSelect.property("value");
    const selectedGroup = groupSelect.property("value");

    const filtered = data.filter(d => d.signal === selectedVital);
    const nested = d3.groups(filtered, d => d[selectedGroup]);

    const summary = nested.map(([key, values]) => {
      const byTime = d3.groups(values, d => d.norm_time).map(([t, pts]) => {
        const v = pts.map(p => p.value);
        return {
          norm_time: +t,
          mean: d3.mean(v),
          sd: d3.deviation(v)
        };
      });
      return { key, values: byTime.sort((a, b) => a.norm_time - b.norm_time) };
    });

    y.domain([d3.min(summary, s => d3.min(s.values, d => d.mean - d.sd)),
              d3.max(summary, s => d3.max(s.values, d => d.mean + d.sd))]);

    svg.select(".x-axis").call(xAxis);
    svg.select(".y-axis").call(yAxis);

    svg.selectAll(".line").data(summary, d => d.key)
      .join("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", d => color(d.key))
      .attr("stroke-width", 2)
      .attr("d", d => line(d.values));

    svg.selectAll(".area").data(summary, d => d.key)
      .join("path")
      .attr("class", "area")
      .attr("fill", d => color(d.key))
      .attr("fill-opacity", 0.2)
      .attr("stroke", "none")
      .attr("d", d => area(d.values));
  }

  vitalSelect.on("change", updateChart);
  groupSelect.on("change", updateChart);
  updateChart();
});