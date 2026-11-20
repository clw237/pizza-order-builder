import type { BasisPoints, Cents } from "./money";

export interface Size {
  id: string;
  label: string;
  price: Cents;
}

/** A topping's price is a share of the pizza's base price, set per category. */
export interface ToppingCategory {
  id: string;
  label: string;
  rate: BasisPoints;
}

export interface Topping {
  id: string;
  label: string;
  categoryId: string;
}

export interface Menu {
  sizes: Size[];
  categories: ToppingCategory[];
  toppings: Topping[];
  taxRate: BasisPoints;
}

export const MENU: Menu = {
  sizes: [
    { id: "small", label: "Small", price: 500 },
    { id: "medium", label: "Medium", price: 700 },
    { id: "large", label: "Large", price: 1200 },
  ],
  categories: [
    { id: "basic", label: "Basic", rate: 800 },
    { id: "premium", label: "Premium", rate: 1100 },
  ],
  toppings: [
    { id: "pepperoni", label: "pepperoni", categoryId: "basic" },
    { id: "sausage", label: "sausage", categoryId: "basic" },
    { id: "extra-cheese", label: "extra cheese", categoryId: "basic" },
    { id: "onions", label: "onions", categoryId: "basic" },
    { id: "black-olives", label: "black olives", categoryId: "basic" },
    { id: "green-peppers", label: "green peppers", categoryId: "basic" },
    { id: "bacon", label: "bacon", categoryId: "premium" },
    { id: "chicken", label: "chicken", categoryId: "premium" },
    { id: "garlic", label: "garlic", categoryId: "premium" },
    {
      id: "artichoke-hearts",
      label: "artichoke hearts",
      categoryId: "premium",
    },
    {
      id: "sun-dried-tomatoes",
      label: "sun-dried tomatoes",
      categoryId: "premium",
    },
    { id: "pineapple", label: "pineapple", categoryId: "premium" },
  ],
  taxRate: 650,
};
