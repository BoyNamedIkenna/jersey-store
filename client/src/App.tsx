import { Jersey, type JerseyProps } from "@/components/Jersey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Temporary preview. These match rows from the seed data; the real catalogue will come from the API.
const samples: (JerseyProps & { name: string })[] = [
  { name: "Arsenal Home", sport: "football", primary: "#DB0007", secondary: "#FFFFFF", accent: "#C9A24D", pattern: "solid", number: "7" },
  { name: "Barcelona Home", sport: "football", primary: "#A50044", secondary: "#004D98", accent: "#EDBB00", pattern: "stripes", number: "10" },
  { name: "Nigeria Away", sport: "football", primary: "#FFFFFF", secondary: "#008751", accent: "#008751", pattern: "hoops", number: "9" },
  { name: "AC Milan Away", sport: "football", primary: "#F5F5F5", secondary: "#FB090B", accent: "#111111", pattern: "sash", number: "11" },
  { name: "Lakers Home", sport: "basketball", primary: "#FDB927", secondary: "#552583", accent: "#FFFFFF", pattern: "solid", number: "23" },
  { name: "Celtics Away", sport: "basketball", primary: "#007A33", secondary: "#FFFFFF", accent: "#FFFFFF", pattern: "solid", number: "0" },
  { name: "Yankees Home", sport: "baseball", primary: "#FFFFFF", secondary: "#0C2340", accent: "#0C2340", pattern: "stripes" },
  { name: "Dodgers Away", sport: "baseball", primary: "#A5ACAF", secondary: "#005A9C", accent: "#005A9C", pattern: "solid" },
];

export default function App() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Jersey preview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {samples.map(({ name, ...jersey }) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Jersey {...jersey} title={name} className="w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}