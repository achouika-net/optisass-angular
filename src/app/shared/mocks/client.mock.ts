export interface IClientStatistics {
  actif: number;
  pro: number;
  passage: number;
  inactif: number;
}

export const MOCK_CLIENT_STATISTICS: IClientStatistics = {
  actif: 150,
  pro: 85,
  passage: 42,
  inactif: 23,
};

export const MOCK_CLIENT = {
  id: 1,
  clientTypeId: 1,
  title: 'Mr',
  lastName: 'Doe',
  firstName: 'John',
  phone: '+1234567890',
  idDocument: 'ID123456',
  familyGroup: 'Family A',
  city: 'New York',
  active: true,
};

export const MOCK_CLIENTS = [
  {
    id: 1,
    clientTypeId: 1,
    title: 'Mr',
    lastName: 'Doe',
    firstName: 'John',
    phone: '+1234567890',
    idDocument: 'ID123456',
    familyGroup: 'Family A',
    city: 'New York',
    active: true,
  },
  {
    id: 2,
    clientTypeId: 1,
    title: 'Mrs',
    lastName: 'Smith',
    firstName: 'Jane',
    phone: '+1234567891',
    idDocument: 'ID123457',
    familyGroup: 'Family B',
    city: 'Los Angeles',
    active: true,
  },
  {
    id: 3,
    clientTypeId: 2,
    title: 'Mr',
    lastName: 'Johnson',
    firstName: 'Robert',
    phone: '+1234567892',
    idDocument: 'ID123458',
    familyGroup: 'Family C',
    city: 'Chicago',
    active: false,
  },
  {
    id: 4,
    clientTypeId: 1,
    title: 'Ms',
    lastName: 'Williams',
    firstName: 'Emily',
    phone: '+1234567893',
    idDocument: 'ID123459',
    familyGroup: 'Family D',
    city: 'Houston',
    active: true,
  },
  {
    id: 5,
    clientTypeId: 2,
    title: 'Mr',
    lastName: 'Brown',
    firstName: 'Michael',
    phone: '+1234567894',
    idDocument: 'ID123460',
    familyGroup: 'Family E',
    city: 'Phoenix',
    active: true,
  },
];
