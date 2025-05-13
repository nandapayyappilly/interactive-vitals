const margin = { top: 50, right: 40, bottom: 50, left: 60 };
const width = 1100 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const svg = d3.select("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");
const drugSelect = d3.select("#drugSelect");

const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).attr("class", "x-axis");
svg.append("g").attr("class", "y-axis");

svg.append("text")
  .attr("text-anchor", "middle")
  .attr("x", width / 2)
  .attr("y", height + margin.bottom - 5)
  .attr("class", "axis-label")
  .text("Progress Through Surgery");

svg.append("text")
  .attr("text-anchor", "middle")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height / 2)
  .attr("y", -margin.left + 15)
  .attr("class", "axis-label")
  .text("Average Vital Value");

const xAxis = d3.axisBottom(x).tickFormat(d3.format(".0%"));
const yAxis = d3.axisLeft(y);

const line = d3.line()
  .x(d => x(d.norm_time))
  .y(d => y(d.mean))
  .curve(d3.curveMonotoneX);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const vitalSelect = d3.select("#vitalSelect");
const groupSelect = d3.select("#groupSelect");

let activeGroups = new Set();

Promise.all([
    d3.csv("data/long_surgery_vitals.csv", d3.autoType),
    d3.csv("data/anesthetic_start_times.csv", d3.autoType)
]).then(([data, anesthetics]) => {
    data.forEach(d => d.signal = d.signal.toLowerCase());

    const allDrugs = [...new Set(anesthetics.map(d => d.tname).filter(name => name.toLowerCase().includes("rate")))];
    const drugNameMap = {
        "orchestra/rftn20_rate": "Remifentanil",
        "orchestra/ppf20_rate": "Propofol"
    };

    drugSelect.selectAll("option")
      .data(["All", ...allDrugs])
      .enter().append("option")
      .text(d => d === "All" ? "All" : drugNameMap[d.toLowerCase()] || d)
      .attr("value", d => d);

    anesthetics.forEach(d => {
        d.tname = d.tname.toLowerCase();
        d.optype = d.optype.trim();
    });

    const vitals = [...new Set(data.map(d => d.signal))];
    const groups = ["optype", "emop"];

    vitalSelect.selectAll("option")
      .data(vitals).enter().append("option")
      .text(d => d).attr("value", d => d);

    groupSelect.selectAll("option")
      .data(groups).enter().append("option")
      .text(d => d === "optype" ? "Surgery Type" : "Emergency Status")
      .attr("value", d => d);

    function updateChart() {
      const selectedVitals = Array.from(vitalSelect.property("selectedOptions")).map(opt => opt.value);
      const selectedGroup = groupSelect.property("value");
      const selectedDrug = drugSelect.property("value").toLowerCase();

      const isSingleSurgery = activeGroups.size === 1 || activeGroups.size === 0;
      if (selectedVitals.length > 1 && !isSingleSurgery) {
        alert("You can only select multiple vitals when one surgery type is selected.");
        return;
      }

      const filtered = data.filter(d => selectedVitals.includes(d.signal));
      const nested = d3.groups(filtered, d => d[selectedGroup]);

      const summary = nested.flatMap(([key, values]) => {
        return selectedVitals.map(vital => {
          const subset = values.filter(d => d.signal === vital);
          const binned = d3.groups(subset, d => Math.round(d.norm_time / 0.01) * 0.01)
            .map(([t, pts]) => {
              const v = pts.map(p => p.value);
              return {
                norm_time: +t,
                mean: d3.mean(v),
                sd: d3.deviation(v),
                value: v[0]
              };
            });
          return { key: `${key} - ${vital}`, values: binned.sort((a, b) => a.norm_time - b.norm_time) };
        });
      });

      const visible = summary.filter(d => activeGroups.size === 0 || activeGroups.has(d.key.split(" - ")[0]));

      y.domain([
        d3.min(visible, s => d3.min(s.values, d => d.mean - (d.sd || 0))),
        d3.max(visible, s => d3.max(s.values, d => d.mean + (d.sd || 0)))
      ]);

      svg.select(".x-axis").call(xAxis);
      svg.select(".y-axis").call(yAxis);

      svg.selectAll(".line").data(visible, d => d.key)
        .join("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", d => color(d.key))
        .attr("stroke-width", 2)
        .attr("d", d => line(d.values));

      svg.selectAll(".hover-point").remove();

      visible.forEach(group => {
        const groupKey = group.key;
        const groupColor = color(groupKey);

        svg.selectAll(`.hover-point-${groupKey}`)
          .data(group.values)
          .enter()
          .append("circle")
          .attr("class", "hover-point")
          .attr("cx", d => x(d.norm_time))
          .attr("cy", d => y(d.mean))
          .attr("r", 5)
          .attr("fill", groupColor)
          .attr("fill-opacity", 0)
          .attr("stroke", "none")
          .on("mouseover", function(event, d) {
            const zScore = d.sd ? ((d.value - d.mean) / d.sd).toFixed(2) : "N/A";
            d3.select(this).transition().duration(100).attr("r", 6).attr("fill-opacity", 0.4);
            tooltip.style("opacity", 1)
              .html(`<strong>${groupKey}</strong><br>Value: ${d.value?.toFixed(1) ?? "N/A"}<br>Mean: ${d.mean?.toFixed(1) ?? "N/A"}<br>SD: ${d.sd?.toFixed(1) ?? "N/A"}<br>Z-score: ${zScore}`)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", function() {
            d3.select(this).transition().duration(100).attr("r", 5).attr("fill-opacity", 0);
            tooltip.style("opacity", 0);
          });
      });

      const legendContainer = d3.select("#legend");
      legendContainer.html("");
      const legendItems = legendContainer.selectAll("div")
        .data(summary.map(d => d.key))
        .enter()
        .append("div")
        .attr("class", "legend-item")
        .style("cursor", "pointer")
        .style("opacity", d => activeGroups.size === 0 || activeGroups.has(d.key.split(" - ")[0]) ? 1 : 0.3)
        .on("click", (event, key) => {
          const groupName = key.split(" - ")[0];
          if (activeGroups.has(groupName)) {
            activeGroups.delete(groupName);
          } else {
            activeGroups.add(groupName);
          }
          updateChart();
        });

      legendItems.append("span")
        .attr("class", "legend-color")
        .style("background-color", d => color(d.key));

      legendItems.append("span")
        .attr("class", "legend-label")
        .text(d => d);
    }

    vitalSelect.on("change", updateChart);
    groupSelect.on("change", updateChart);
    drugSelect.on("change", updateChart);
    vitalSelect.property("value", "map");
    groupSelect.property("value", "emop");
    drugSelect.property("value", "All");
    updateChart();
});