// Swedish municipalities with tax rates for 2026
// Source: SCB (Statistiska centralbyrån)

export interface Municipality {
  name: string;
  taxRate: number; // Total kommunalskatt (kommun + region)
  county: string;
  // Tax breakdown (approximate values based on typical distribution)
  municipalTax?: number; // Kommunalskatt
  regionTax?: number; // Regionskatt (landstingsskatt)
  burialFee?: number; // Begravningsavgift
}

// Selection of Swedish municipalities with their tax rates
export const MUNICIPALITIES: Municipality[] = [
  // Västra Götaland
  { name: 'Kungsbacka', taxRate: 32.87, county: 'Halland', municipalTax: 21.33, regionTax: 11.18, burialFee: 0.26 },
  { name: 'Göteborg', taxRate: 33.54, county: 'Västra Götaland', municipalTax: 21.12, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Mölndal', taxRate: 32.64, county: 'Västra Götaland', municipalTax: 20.51, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Kungälv', taxRate: 33.08, county: 'Västra Götaland', municipalTax: 21.36, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Partille', taxRate: 32.76, county: 'Västra Götaland', municipalTax: 20.54, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Lerum', taxRate: 32.63, county: 'Västra Götaland', municipalTax: 20.65, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Härryda', taxRate: 32.68, county: 'Västra Götaland', municipalTax: 20.70, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Stenungsund', taxRate: 33.31, county: 'Västra Götaland', municipalTax: 21.59, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Tjörn', taxRate: 33.53, county: 'Västra Götaland', municipalTax: 21.81, regionTax: 11.48, burialFee: 0.26 },
  { name: 'Orust', taxRate: 34.14, county: 'Västra Götaland', municipalTax: 22.42, regionTax: 11.48, burialFee: 0.26 },
  
  // Stockholm
  { name: 'Stockholm', taxRate: 32.08, county: 'Stockholm', municipalTax: 18.93, regionTax: 12.80, burialFee: 0.12 },
  { name: 'Solna', taxRate: 29.48, county: 'Stockholm', municipalTax: 17.37, regionTax: 12.80, burialFee: 0.11 },
  { name: 'Sundbyberg', taxRate: 30.69, county: 'Stockholm', municipalTax: 18.59, regionTax: 12.80, burialFee: 0.11 },
  { name: 'Nacka', taxRate: 30.02, county: 'Stockholm', municipalTax: 17.88, regionTax: 12.80, burialFee: 0.11 },
  { name: 'Danderyd', taxRate: 30.58, county: 'Stockholm', municipalTax: 18.25, regionTax: 12.80, burialFee: 0.12 },
  { name: 'Lidingö', taxRate: 30.38, county: 'Stockholm', municipalTax: 18.08, regionTax: 12.80, burialFee: 0.11 },
  { name: 'Täby', taxRate: 29.93, county: 'Stockholm', municipalTax: 17.55, regionTax: 12.80, burialFee: 0.12 },
  { name: 'Upplands Väsby', taxRate: 31.17, county: 'Stockholm', municipalTax: 19.05, regionTax: 12.80, burialFee: 0.12 },
  { name: 'Vallentuna', taxRate: 30.88, county: 'Stockholm', municipalTax: 18.77, regionTax: 12.80, burialFee: 0.12 },
  { name: 'Österåker', taxRate: 30.73, county: 'Stockholm', municipalTax: 18.63, regionTax: 12.80, burialFee: 0.12 },
  
  // Skåne
  { name: 'Malmö', taxRate: 34.99, county: 'Skåne', municipalTax: 21.24, regionTax: 12.37, burialFee: 0.28 },
  { name: 'Helsingborg', taxRate: 32.74, county: 'Skåne', municipalTax: 20.65, regionTax: 12.37, burialFee: 0.25 },
  { name: 'Lund', taxRate: 32.42, county: 'Skåne', municipalTax: 21.24, regionTax: 12.37, burialFee: 0.23 },
  { name: 'Landskrona', taxRate: 32.74, county: 'Skåne', municipalTax: 20.24, regionTax: 12.37, burialFee: 0.25 },
  { name: 'Trelleborg', taxRate: 32.20, county: 'Skåne', municipalTax: 20.40, regionTax: 12.37, burialFee: 0.25 },
  { name: 'Kristianstad', taxRate: 32.44, county: 'Skåne', municipalTax: 21.56, regionTax: 12.37, burialFee: 0.25 },
  { name: 'Vellinge', taxRate: 30.09, county: 'Skåne', municipalTax: 18.50, regionTax: 12.37, burialFee: 0.22 },
  { name: 'Lomma', taxRate: 31.25, county: 'Skåne', municipalTax: 19.64, regionTax: 12.37, burialFee: 0.24 },
  
  // Halland
  { name: 'Halmstad', taxRate: 32.29, county: 'Halland', municipalTax: 20.98, regionTax: 11.18, burialFee: 0.26 },
  { name: 'Varberg', taxRate: 32.50, county: 'Halland', municipalTax: 21.06, regionTax: 11.18, burialFee: 0.26 },
  { name: 'Falkenberg', taxRate: 32.39, county: 'Halland', municipalTax: 20.95, regionTax: 11.18, burialFee: 0.26 },
  
  // Östergötland
  { name: 'Linköping', taxRate: 33.35, county: 'Östergötland', municipalTax: 20.20, regionTax: 11.55, burialFee: 0.25 },
  { name: 'Norrköping', taxRate: 32.73, county: 'Östergötland', municipalTax: 21.75, regionTax: 11.55, burialFee: 0.25 },
  { name: 'Motala', taxRate: 32.58, county: 'Östergötland', municipalTax: 21.60, regionTax: 11.55, burialFee: 0.25 },
  
  // Uppsala
  { name: 'Uppsala', taxRate: 33.25, county: 'Uppsala', municipalTax: 21.14, regionTax: 11.71, burialFee: 0.28 },
  { name: 'Enköping', taxRate: 33.15, county: 'Uppsala', municipalTax: 21.16, regionTax: 11.71, burialFee: 0.28 },
  
  // Jönköping
  { name: 'Jönköping', taxRate: 33.20, county: 'Jönköping', municipalTax: 21.64, regionTax: 11.26, burialFee: 0.30 },
  { name: 'Värnamo', taxRate: 33.05, county: 'Jönköping', municipalTax: 21.49, regionTax: 11.26, burialFee: 0.30 },
  
  // Örebro
  { name: 'Örebro', taxRate: 34.19, county: 'Örebro', municipalTax: 21.35, regionTax: 11.55, burialFee: 0.29 },
  { name: 'Karlskoga', taxRate: 33.40, county: 'Örebro', municipalTax: 22.56, regionTax: 11.55, burialFee: 0.29 },
  
  // Västmanland
  { name: 'Västerås', taxRate: 33.26, county: 'Västmanland', municipalTax: 20.36, regionTax: 10.88, burialFee: 0.28 },
  { name: 'Köping', taxRate: 33.08, county: 'Västmanland', municipalTax: 21.92, regionTax: 10.88, burialFee: 0.28 },
  
  // Södermanland
  { name: 'Eskilstuna', taxRate: 33.08, county: 'Södermanland', municipalTax: 22.18, regionTax: 10.83, burialFee: 0.27 },
  { name: 'Nyköping', taxRate: 32.68, county: 'Södermanland', municipalTax: 21.58, regionTax: 10.83, burialFee: 0.27 },
  
  // Dalarna
  { name: 'Falun', taxRate: 33.55, county: 'Dalarna', municipalTax: 22.06, regionTax: 11.64, burialFee: 0.29 },
  { name: 'Borlänge', taxRate: 34.00, county: 'Dalarna', municipalTax: 22.51, regionTax: 11.64, burialFee: 0.29 },
  
  // Gävleborg
  { name: 'Gävle', taxRate: 33.35, county: 'Gävleborg', municipalTax: 22.26, regionTax: 11.51, burialFee: 0.28 },
  { name: 'Sandviken', taxRate: 33.53, county: 'Gävleborg', municipalTax: 22.44, regionTax: 11.51, burialFee: 0.28 },
  
  // Västernorrland
  { name: 'Sundsvall', taxRate: 34.08, county: 'Västernorrland', municipalTax: 22.59, regionTax: 11.29, burialFee: 0.30 },
  { name: 'Örnsköldsvik', taxRate: 34.23, county: 'Västernorrland', municipalTax: 22.74, regionTax: 11.29, burialFee: 0.30 },
  
  // Jämtland
  { name: 'Östersund', taxRate: 34.03, county: 'Jämtland', municipalTax: 22.02, regionTax: 11.70, burialFee: 0.31 },
  { name: 'Åre', taxRate: 33.98, county: 'Jämtland', municipalTax: 21.97, regionTax: 11.70, burialFee: 0.31 },
  
  // Västerbotten
  { name: 'Umeå', taxRate: 34.25, county: 'Västerbotten', municipalTax: 22.80, regionTax: 11.35, burialFee: 0.30 },
  { name: 'Skellefteå', taxRate: 34.18, county: 'Västerbotten', municipalTax: 22.73, regionTax: 11.35, burialFee: 0.30 },
  
  // Norrbotten
  { name: 'Luleå', taxRate: 33.75, county: 'Norrbotten', municipalTax: 22.50, regionTax: 11.34, burialFee: 0.28 },
  { name: 'Kiruna', taxRate: 34.03, county: 'Norrbotten', municipalTax: 23.05, regionTax: 11.34, burialFee: 0.28 },
  { name: 'Boden', taxRate: 34.38, county: 'Norrbotten', municipalTax: 23.40, regionTax: 11.34, burialFee: 0.28 },
  
  // Blekinge
  { name: 'Karlskrona', taxRate: 33.27, county: 'Blekinge', municipalTax: 21.65, regionTax: 11.86, burialFee: 0.26 },
  { name: 'Karlshamn', taxRate: 33.74, county: 'Blekinge', municipalTax: 22.12, regionTax: 11.86, burialFee: 0.26 },
  
  // Kronoberg
  { name: 'Växjö', taxRate: 32.19, county: 'Kronoberg', municipalTax: 20.66, regionTax: 12.00, burialFee: 0.27 },
  { name: 'Ljungby', taxRate: 32.49, county: 'Kronoberg', municipalTax: 20.96, regionTax: 12.00, burialFee: 0.27 },
  
  // Kalmar
  { name: 'Kalmar', taxRate: 33.03, county: 'Kalmar', municipalTax: 21.81, regionTax: 11.86, burialFee: 0.26 },
  { name: 'Oskarshamn', taxRate: 33.50, county: 'Kalmar', municipalTax: 22.28, regionTax: 11.86, burialFee: 0.26 },
  
  // Gotland
  { name: 'Gotland', taxRate: 33.60, county: 'Gotland', municipalTax: 33.25, regionTax: 0, burialFee: 0.35 },
  
  // Värmland
  { name: 'Karlstad', taxRate: 33.00, county: 'Värmland', municipalTax: 21.27, regionTax: 11.68, burialFee: 0.27 },
  { name: 'Arvika', taxRate: 33.40, county: 'Värmland', municipalTax: 21.67, regionTax: 11.68, burialFee: 0.27 },
];

// Get municipality by name
export const getMunicipalityByName = (name: string): Municipality | undefined => {
  return MUNICIPALITIES.find(m => m.name.toLowerCase() === name.toLowerCase());
};

// Get all municipalities sorted by name
export const getMunicipalitiesSorted = (): Municipality[] => {
  return [...MUNICIPALITIES].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
};

// Get municipalities by county
export const getMunicipalitiesByCounty = (county: string): Municipality[] => {
  return MUNICIPALITIES.filter(m => m.county === county).sort((a, b) => 
    a.name.localeCompare(b.name, 'sv')
  );
};

// Get all unique counties
export const getCounties = (): string[] => {
  return [...new Set(MUNICIPALITIES.map(m => m.county))].sort((a, b) => 
    a.localeCompare(b, 'sv')
  );
};

// Default municipality
export const DEFAULT_MUNICIPALITY: Municipality = {
  name: 'Kungsbacka',
  taxRate: 32.87,
  county: 'Halland',
  municipalTax: 21.33,
  regionTax: 11.18,
  burialFee: 0.26,
};

/**
 * Calculate net salary from gross salary and municipality tax rate
 * Note: Does not include job tax credit (jobbskatteavdrag) as it's complex to calculate accurately
 */
export const calculateNetSalaryFromGross = (
  monthlyGrossSalary: number,
  municipalTaxRate: number // as decimal, e.g., 0.3287 for 32.87%
): { netSalary: number; taxAmount: number } => {
  const taxAmount = Math.round(monthlyGrossSalary * municipalTaxRate);
  const netSalary = Math.round(monthlyGrossSalary - taxAmount);
  
  return { netSalary, taxAmount };
};
