/** All UI text is Georgian. Keep strings here, not in screens. Wording is ours, not official brand copy. */
export const ka = {
  appName: "Gochit's",
  login: { title: 'შესვლა', phone: 'ტელეფონის ნომერი', send: 'კოდის გაგზავნა', invalid: 'შეიყვანე 9-ნიშნა ნომერი' },
  otp: { title: 'შეიყვანე კოდი', confirm: 'დადასტურება', resend: 'ხელახლა გაგზავნა', wrong: 'კოდი არასწორია' },
  address: { title: 'მისამართი', street: 'ქუჩა და სახლის ნომერი', entrance: 'სადარბაზო', floor: 'სართული', apartment: 'ბინა', save: 'მისამართის შენახვა', outside: 'ამ მისამართზე მიტანა ჯერ არ არის' },
  branch: { title: 'აირჩიე ფილიალი', nearest: 'უახლოესი', closed: 'ახლა დახურულია', fee: 'მიტანა', time: 'დრო', min: 'მინ.', see: 'მენიუს ნახვა', change: 'შეცვლა', hint: 'ღირებულებასა და დროს ანგარიშობს სერვერი' },
  menu: { search: 'მოძებნე მენიუში', unapprovedPrices: 'ფასები ნანახია Wolt-ზე (დიღმის ფილიალი) და დასადასტურებელია', add: 'დამატება' },
  cart: { title: 'კალათა', empty: 'კალათა ცარიელია', subtotal: 'პროდუქტები', checkout: 'გაფორმება' },
  checkout: { title: 'გაფორმება', place: 'შეკვეთის გაგზავნა', notes: 'კომენტარი', payment: 'გადახდა' },
  errors: {
    generic: 'რაღაც შეფერხდა. სცადე თავიდან',
    branch_unavailable: 'ფილიალი ახლა შეკვეთებს არ იღებს',
    outside_zone: 'ეს მისამართი მიტანის ზონაში არ არის',
    fee_not_configured: 'მიტანის ღირებულება ჯერ არ არის დაყენებული',
    below_minimum: 'შეკვეთა მინიმალურ თანხაზე ნაკლებია',
    product_unavailable: 'ერთ-ერთი პროდუქტი ახლა მიუწვდომელია',
    cash_not_allowed: 'ამ ფილიალში ნაღდი ანგარიშსწორება ჩართული არ არის',
  },
} as const;

export function errorText(code: string): string {
  const e = ka.errors as Record<string, string>;
  return e[code] ?? ka.errors.generic;
}
