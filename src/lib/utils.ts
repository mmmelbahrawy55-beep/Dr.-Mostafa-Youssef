export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const formatNumber = (value: number) => value.toLocaleString("en-US");

export const formatPrice = (price: string) => price.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
