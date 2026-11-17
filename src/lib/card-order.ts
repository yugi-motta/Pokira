type OrderedCard={releaseDate:string|null;number:string;id:string;sortReleaseDate?:string|null;sortNumber?:string};
export const cardDate=(card:OrderedCard)=>card.sortReleaseDate!==undefined?card.sortReleaseDate:card.releaseDate;
export function compareCards(a: OrderedCard, b: OrderedCard) {
  return (cardDate(b)||'').localeCompare(cardDate(a)||'') || (a.sortNumber||a.number).localeCompare(b.sortNumber||b.number,'en',{numeric:true}) || a.id.localeCompare(b.id,'en');
}
