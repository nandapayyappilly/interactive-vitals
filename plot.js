const svg = d3.select("svg"),
      width = +svg.attr("width") - 100,
      height = +svg.attr("height") - 100,
      margin = { top: 50, right: 50, bottom: 50, left: 50 };

const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().domain([0, 1]).range([0, width]);
const yScale = d3.scaleLinear().range([height, 0]);

const color = d3.scaleOrdinal(d3.schemeTableau10);

const xAxis = chart.append("g").attr("transform", `translate(0,${height})`);
const yAxis = chart.append("g");

const vitalSelect = d3.select("body").insert("select", ":first-child")
  .attr("id", "vital-select")
  .selectAll("option")
  .data(["map", "hr", "spo2"])
  .enter().append("option")
  .text(d => d.toUpperCase());

const groupSelect = d3.select("body").insert("select", ":first-child")
  .attr("id", "group-select")
  .selectAll("option")
  .data(["optype", "emop"])
  .enter().append("option")
  .text(d => d === "optype" ? "Surgery Type" : "Emergency Flag");

d3.csv("data/long_surgery_vitals.csv", d3.autoType).then(data => {
  update("map", "optype");

  d3.select("#vital-select").on("change", function() {
    const vital = this.value;
    const group = document.getElementById("group-select").value;
    update(vital, group);
  });

  d3.select("#group-select").on("change", function() {
    const group = this.value;
    const vital = document.getElementById("vital-select").value;
    update(vital, group);
  });

  function update(vital, group) {
    const nested = d3.groups(
      data.filter(d => d.signal === vital && !isNaN(d.value)),
      d => d[group]
    );

    const line = d3.line()
      .x(d => xScale(d.norm_time))
      .y(d => yScale(d.mean));

    const area = d3.area()
      .x(d => xScale(d.norm_time))
      .y0(d => yScale(d.mean - d.stdev))
      .y1(d => yScale(d.mean + d.stdev));

    const summary = nested.map(([key, values]) => {
      const binned = d3.bin()
        .value(d => d.norm_time)
        .thresholds(100)(values);
      const points = binned.map(bin => {
        const mean = d3.mean(bin, d => d.value);
        const stdev = d3.deviation(bin, d => d.value) || 0;
        return {
          norm_time: (bin.x0 + bin.x1) / 2,
          mean,
          stdev
        };
      }).filter(d => !isNaN(d.mean));
      return { key, points };
    });

    yScale.domain([d3.min(summary, s => d3.min(s.points, d => d.mean - d.stdev)),
                   d3.max(summary, s => d3.max(s.points, d => d.mean + d.stdev))]);

    xAxis.call(d3.axisBottom(xScale).tickFormat(d => `${Math.round(d * 100)}%`));
    yAxis.call(d3.axisLeft(yScale));

    chart.selectAll(".group").remove();

    const groups = chart.selectAll(".group")
      .data(summary)
      .enter().append("g")
      .attr("class", "group");

    groups.append("path")
      .attr("fill", (d, i) => color(i))
      .attr("opacity", 0.2)
      .attr("d", d => area(d.points));

    groups.append("path")
      .attr("stroke", (d, i) => color(i))
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("d", d => line(d.points));
  }
});