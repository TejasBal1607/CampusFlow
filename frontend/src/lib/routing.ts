export const CAMPUS_EDGES = [
  // Main Gate (47) connects to ADM Block (46)
  { source: 47, target: 46, weight: 1, type: 'main' },
  // ADM Block (46) connects to Library Chowk (35)
  { source: 46, target: 35, weight: 2, type: 'main' },
  // Library Chowk (35) connects to Central Library (24)
  { source: 35, target: 24, weight: 1, type: 'main' },
  // Library (24) connects to Kravings (13) via an internal path
  { source: 24, target: 13, weight: 3, type: 'internal' },
  // Library Chowk (35) connects to H Chowk (18)
  { source: 35, target: 18, weight: 4, type: 'main' },
  // H Chowk (18) connects to H Hostel (2)
  { source: 18, target: 2, weight: 1, type: 'main' },
  // H Chowk (18) connects to J Hostel (1)
  { source: 18, target: 1, weight: 2, type: 'internal' },
  // ... you will eventually map out the rest of the campus like this!
];

// 2. The Routing Algorithm (Dijkstra's Shortest Path)
export const findShortestPath = (
  startId: number, 
  targetId: number, 
  nodes: any[], 
  edges: any[],
  avoidInternal: boolean = false
) => {
  // Setup Adjacency List
  const graph: Record<number, { node: number, weight: number }[]> = {};
  nodes.forEach(n => graph[n.id] = []);
  
  edges.forEach(edge => {
    // If user wants only main roads and this is internal, or if road is blocked, skip it!
    if (avoidInternal && edge.type === 'internal') return;
    if (edge.blocked) return; 

    // Bi-directional connections
    if (graph[edge.source] && graph[edge.target]) {
      graph[edge.source].push({ node: edge.target, weight: edge.weight });
      graph[edge.target].push({ node: edge.source, weight: edge.weight });
    }
  });

  // Standard Dijkstra Initialization
  const distances: Record<number, number> = {};
  const previous: Record<number, number | null> = {};
  const unvisited = new Set<number>();

  nodes.forEach(n => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
    unvisited.add(n.id);
  });
  distances[startId] = 0;

  while (unvisited.size > 0) {
    // Find the unvisited node with the smallest distance
    let current = Array.from(unvisited).reduce((minNode, node) => 
      distances[node] < distances[minNode] ? node : minNode
    );

    if (distances[current] === Infinity) break; // Trapped (No path available)
    if (current === targetId) break; // Found the destination!

    unvisited.delete(current);

    // Update distances to neighbors
    graph[current].forEach(neighbor => {
      if (unvisited.has(neighbor.node)) {
        const newDist = distances[current] + neighbor.weight;
        if (newDist < distances[neighbor.node]) {
          distances[neighbor.node] = newDist;
          previous[neighbor.node] = current;
        }
      }
    });
  }

  // Backtrack to build the final path array
  const path: number[] = [];
  let curr: number | null = targetId;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  // If path only has 1 node, it means no connection was found
  if (path.length === 1 && path[0] !== startId) return null; 

  // Return the actual coordinate points for Leaflet to draw
  return path.map(id => {
    const node = nodes.find(n => n.id === id);
    return [node.coords[0], node.coords[1]]; // [y, x]
  });
};

// 3. Helper: Snap GPS to nearest Node
export const findNearestNodeId = (y: number, x: number, nodes: any[]) => {
  let nearestId = nodes[0].id;
  let minDistance = Infinity;

  nodes.forEach(node => {
    // Pythagorean distance formula
    const dist = Math.sqrt(Math.pow(node.coords[0] - y, 2) + Math.pow(node.coords[1] - x, 2));
    if (dist < minDistance) {
      minDistance = dist;
      nearestId = node.id;
    }
  });

  return nearestId;
};