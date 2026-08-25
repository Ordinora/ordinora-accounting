export type CapitalAllowanceInput={originalCost:number;qualifyingAddition:number;taxWrittenDownValueBf:number;disposalDeduction:number;initialAllowanceRate:number;annualAllowanceRate:number;privateUsePercent:number};

export function calculateCapitalAllowance(input:CapitalAllowanceInput){
  const businessUse=Math.max(0,1-input.privateUsePercent/100);
  const available=Math.max(0,input.taxWrittenDownValueBf+input.qualifyingAddition-input.disposalDeduction);
  const initialAllowance=Math.min(available,Math.max(0,input.qualifyingAddition*input.initialAllowanceRate/100*businessUse));
  const afterInitial=Math.max(0,available-initialAllowance);
  const annualAllowance=Math.min(afterInitial,Math.max(0,input.originalCost*input.annualAllowanceRate/100*businessUse));
  return{available,initialAllowance,annualAllowance,closingTwdv:Math.max(0,afterInitial-annualAllowance)};
}
