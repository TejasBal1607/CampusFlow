from app.database import SessionLocal
from app import models

SCALE_Y = 1080 / 3000
SCALE_X = 1920 / 4000

# THE COMPLETE 117-ITEM LIST
LOCATIONS = [
  { "id": 1, "name": "J Hostel (Tejas Hall)", "category": "Hostel", "desc": "1st and 3rd year Boys Hostel (7 Floors) with Single Seater and Double Seater Rooms with AC in West Side and non AC in East Sideand Common Washrooms", "coords": [892, 1317], "rating": 3.5, "image_url": "https://via.placeholder.com/400" },
  { "id": 2, "name": "H Hostel (Vyan Hall)", "category": "Hostel", "desc": "1st year Boys Hostel (4 Floors) with Four Seater Rooms with AC and Common Washrooms", "coords": [891, 1605], "rating": 3.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 3, "name": "C Hostel (Prithvi Hall)", "category": "Hostel", "desc": "2nd year Boys Hostel (2 Floors)with Double Seater and Triple Seater Rooms with AC and Common Washrooms", "coords": [167, 520], "rating": 3.5, "image_url": "https://via.placeholder.com/400" },
  { "id": 4, "name": "D Hostel (Neeram Hall)", "category": "Hostel", "desc": "2nd year Boys Hostel (8 Floors) with Double Seater Rooms with AC and Attached Washrooms", "coords": [176, 211], "rating": 4.5, "image_url": "https://via.placeholder.com/400" },
  { "id": 5, "name": "O Hostel (Vyom Hall)", "category": "Hostel", "desc": "2nd year and 3rd yearBoys Hostel (8 Floors) with Double Seater Rooms with AC and Attached Washrooms", "coords": [210, 840], "rating": 4.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 6, "name": "B Hostel (Amritam Hall)", "category": "Hostel", "desc": "2nd year Boys Hostel (2 Floors) with Single and Double Seater Rooms with AC and Common Washrooms", "coords": [172, 1064], "rating": 3.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 7, "name": "A Hostel (Agira Hall)", "category": "Hostel", "desc": "3rd year Boys Hostel (8 Floors) with Double Seater Rooms with AC and Attached Washrooms", "coords": [186, 1442], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 8, "name": "Nirvana Central Park", "category": "Park", "desc": "The main and central park with lush greenery multiple sitouts and fountain. Recommended not to wonder alone during evening hours due to 😜...", "coords": [752, 2136], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 9, "name": "Athletic Track", "category": "Facility", "desc": "Athletic Track area.", "coords": [1451, 820], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 10, "name": "COS", "category": "Shops", "desc": "Campus open shops and eateries.", "coords": [1353, 1078], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 11, "name": "OAT", "category": "Facility", "desc": "Open Air Theater", "coords": [1711, 1049], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 12, "name": "M Hostel (Anantam Hall)", "category": "Hostel", "desc": "4th year Boys Hostel (Multiple Blocks) with Single and Double Seater Rooms with AC and Attached Washrooms", "coords": [1156, 546], "rating": 4.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 13, "name": "Kravings Food Court", "category": "Food", "desc": "Main food court area.", "coords": [1084, 2206], "rating": 4.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 14, "name": "Swimming Pool", "category": "Facility", "desc": "Campus Swimming Pool", "coords": [1410, 1993], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 15, "name": "N Hostel (Ananta Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [1421, 2344], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 16, "name": "I Hostel (Ira Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [1667, 2352], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 17, "name": "Girls Hostel Block Main Gate", "category": "Waypoint", "desc": "Main entry to the girls hostel block.", "coords": [1181, 2332], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 18, "name": "H Chowk", "category": "Waypoint", "desc": "Main junction near H hostel.", "coords": [1165, 1689], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 19, "name": "E Hostel (Vasudha Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [1402, 2265], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 20, "name": "G Hostel (Vasudha Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [1728, 2267], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 21, "name": "Girls Hostel Back Gate", "category": "Waypoint", "desc": "Secondary entry gate.", "coords": [1869, 2338], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 22, "name": "LP Lawns", "category": "Park", "desc": "Relaxing lawn area.", "coords": [1630, 2705], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 23, "name": "Waterbody Cafe", "category": "Food", "desc": "Cafe near the water feature.", "coords": [1397, 3071], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 24, "name": "Nava Nalanda Central Library", "category": "Building", "desc": "Main campus library.", "coords": [1284, 3030], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 25, "name": "LT Block", "category": "Building", "desc": "Lecture Theater block.", "coords": [1468, 2855], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 26, "name": "CSED", "category": "Building", "desc": "Computer Science & Engineering Department.", "coords": [1624, 3036], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 27, "name": "Library Skywalk Stairs", "category": "Waypoint", "desc": "Staircase access.", "coords": [1510, 3034], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 28, "name": "Skywalk", "category": "Waypoint", "desc": "Elevated walkway.", "coords": [1499, 3110], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 29, "name": "DOSA/DOAA Office", "category": "Building", "desc": "Dean's offices.", "coords": [1567, 3315], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 30, "name": "TSLAS", "category": "Building", "desc": "Thapar School of Liberal Arts and Sciences.", "coords": [1894, 3738], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 31, "name": "Venture Labs", "category": "Building", "desc": "Innovation and startup labs.", "coords": [1807, 3561], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 32, "name": "R&D Gate", "category": "Waypoint", "desc": "Research and Development area gate.", "coords": [1779, 3905], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 33, "name": "ELC", "category": "Building", "desc": "Experiential Learning Center.", "coords": [1210, 3728], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 34, "name": "Mechanical Workshop", "category": "Building", "desc": "Main workshop area.", "coords": [1240, 3448], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 35, "name": "Library Chowk", "category": "Waypoint", "desc": "Junction near the library.", "coords": [1162, 3068], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 36, "name": "TAN Building", "category": "Building", "desc": "Academic building.", "coords": [1089, 2636], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 37, "name": "G Block", "category": "Building", "desc": "Academic block.", "coords": [922, 2883], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 38, "name": "B Block", "category": "Building", "desc": "Academic block.", "coords": [620, 3140], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 39, "name": "C Block", "category": "Building", "desc": "Academic block.", "coords": [821, 3124], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 40, "name": "D Block", "category": "Building", "desc": "Academic block.", "coords": [1040, 3120], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 41, "name": "F Block", "category": "Building", "desc": "Academic block.", "coords": [962, 3575], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 42, "name": "E Block", "category": "Building", "desc": "Academic block.", "coords": [718, 3601], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 43, "name": "H Block", "category": "Building", "desc": "Academic block.", "coords": [598, 3769], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 44, "name": "Aahaar", "category": "Food", "desc": "Food joint.", "coords": [609, 3649], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 45, "name": "Kulcha Zone", "category": "Food", "desc": "Famous for Kulchas.", "coords": [559, 3683], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 46, "name": "ADM Block", "category": "Building", "desc": "Administration Block.", "coords": [353, 3445], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 47, "name": "Main Gate", "category": "Waypoint", "desc": "Campus entrance.", "coords": [76, 3893], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 48, "name": "Back Gate", "category": "Waypoint", "desc": "Secondary entrance.", "coords": [1201, 87], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 49, "name": "Gurudwara", "category": "Facility", "desc": "Campus Gurudwara.", "coords": [654, 973], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 50, "name": "Shiv Mandir", "category": "Facility", "desc": "Campus Temple.", "coords": [761, 971], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 51, "name": "Cricket Ground", "category": "Facility", "desc": "Main sports ground.", "coords": [2255, 1412], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 52, "name": "FRF", "category": "Misc", "desc": "Faculty Residence F.", "coords": [672, 40], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 53, "name": "FRG", "category": "Misc", "desc": "Faculty Residence G.", "coords": [751, 39], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 54, "name": "Just Food", "category": "Food", "desc": "Eatery.", "coords": [267, 777], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 55, "name": "Anapoorna", "category": "Food", "desc": "Food joint.", "coords": [751, 1713], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 56, "name": "PG-2 Hostel Avani Hall", "category": "Hostel", "desc": "Postgrad Hostel.", "coords": [103, 849], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 57, "name": "Q Hostel Vahni Hall", "category": "Hostel", "desc": "Hostel building.", "coords": [118, 1108], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 58, "name": "South Pole Canteen", "category": "Food", "desc": "Canteen area.", "coords": [559, 1104], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 59, "name": "Basketball Court", "category": "Facility", "desc": "Sports court.", "coords": [661, 843], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 60, "name": "Tennis court", "category": "Facility", "desc": "Sports court.", "coords": [670, 751], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 61, "name": "Indoor Badminton Court", "category": "Facility", "desc": "Sports court.", "coords": [608, 866], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 62, "name": "Guest House", "category": "Building", "desc": "Official campus guest house.", "coords": [71, 1358], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 63, "name": "G block canteen", "category": "Food", "desc": "Canteen.", "coords": [220, 1308], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 64, "name": "Jaggi", "category": "Food", "desc": "Famous spot for shakes and juices", "coords": [268, 1328], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 65, "name": "G block stalls", "category": "Food", "desc": "Stalls area.", "coords": [250, 1327], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 66, "name": "PG-1 Hostel Dhriti Hall", "category": "Hostel", "desc": "Postgrad Hostel.", "coords": [97, 975], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 67, "name": "TSLAS (Flavours) cafe", "category": "Food", "desc": "Cafe.", "coords": [723, 1845], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 68, "name": "Sports Office", "category": "Building", "desc": "Administration for sports.", "coords": [728, 826], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 69, "name": "K Hostel (Ambaram Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [971, 691], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 70, "name": "L Hostel (Viyat Hall)", "category": "Hostel", "desc": "Hostel building.", "coords": [986, 1049], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 71, "name": "Polytechnic College", "category": "Building", "desc": "College block.", "coords": [998, 1181], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 72, "name": "K Lawns", "category": "Park", "desc": "Lawn area.", "coords": [192, 1602], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 73, "name": "Necafe", "category": "Food", "desc": "Coffee shop.", "coords": [173, 1441], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 74, "name": "Banks", "category": "Facility", "desc": "Campus banks.", "coords": [155, 1500], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 75, "name": "Stationary Shop", "category": "Shops", "desc": "Shop.", "coords": [175, 1442], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 76, "name": "Main Auditorium", "category": "Rooms", "desc": "Main events hall.", "coords": [62, 1532], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 77, "name": "Dispensary", "category": "Facility", "desc": "Medical facility.", "coords": [724, 1383], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 78, "name": "Polytechnic Gate", "category": "Waypoint", "desc": "Gate.", "coords": [1050, 928], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 79, "name": "FETE Area/Football Ground", "category": "Facility", "desc": "Main grounds.", "coords": [558, 673], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 80, "name": "Hockey Ground", "category": "Facility", "desc": "Hockey grounds.", "coords": [656, 635], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 81, "name": "Tan Auditorium", "category": "Rooms", "desc": "Auditorium space.", "coords": [356, 1258], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 82, "name": "TSLAS Auditorium", "category": "Rooms", "desc": "Auditorium.", "coords": [701, 1846], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 83, "name": "LP101 - LP104", "category": "Rooms", "desc": "Lecture rooms.", "coords": [449, 1289], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 84, "name": "Mangla Laundramat ", "category": "Facility", "desc": "Laundry.", "coords": [958, 85], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 85, "name": "Water Treatment Plant", "category": "Facility", "desc": "Utility.", "coords": [1001, 130], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 86, "name": "Chancelor Residence ", "category": "Waypoint", "desc": "Residence.", "coords": [1005, 1710], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 87, "name": "Department Of Energy and Environment", "category": "Building", "desc": "Academic block.", "coords": [824, 1780], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 88, "name": "CEEMS LAB", "category": "Rooms", "desc": "Lab area.", "coords": [781, 1841], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 89, "name": "Detension Pond", "category": "Waypoint", "desc": "Water area.", "coords": [52, 1651], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 90, "name": "Faculty residence ", "category": "Waypoint", "desc": "Residence.", "coords": [988, 1509], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 91, "name": "Faculty residence garden", "category": "Waypoint", "desc": "Garden.", "coords": [965, 1646], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 92, "name": "Electronics shop", "category": "Shops", "desc": "Shop.", "coords": [513, 513], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 93, "name": "Stationary Shop 2", "category": "Shops", "desc": "Shop.", "coords": [561, 454], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 94, "name": "Cosmetics Shop", "category": "Shops", "desc": "Shop.", "coords": [549, 461], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 95, "name": "Shadowz Salon", "category": "Shops", "desc": "Salon.", "coords": [543, 473], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 96, "name": "Chilli Chatkara", "category": "Shops", "desc": "Eatery.", "coords": [533, 485], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 97, "name": "Chai Vyanjan", "category": "Shops", "desc": "Cafe.", "coords": [366, 1007], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 98, "name": "Activity Space 2", "category": "Rooms", "desc": "Space.", "coords": [564, 1348], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 99, "name": "Activity Space 1", "category": "Rooms", "desc": "Space.", "coords": [563, 1389], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 100, "name": "Domino's", "category": "Food", "desc": "Food joint.", "coords": [393, 1021], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 101, "name": "Nic", "category": "Food", "desc": "Food joint.", "coords": [380, 1070], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 102, "name": "Barista", "category": "Food", "desc": "Cafe.", "coords": [394, 1033], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 103, "name": "Bugrill", "category": "Food", "desc": "Food joint.", "coords": [393, 1039], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 104, "name": "Moti Mahal Delux", "category": "Food", "desc": "Restaurant.", "coords": [393, 1048], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 105, "name": "Anna Chow Pati", "category": "Food", "desc": "Food joint.", "coords": [394, 1060], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 106, "name": "Subway", "category": "Food", "desc": "Food joint.", "coords": [394, 1069], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 107, "name": "C Hall", "category": "Rooms", "desc": "Hall.", "coords": [223, 1723], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 108, "name": "Streat Cafe", "category": "Food", "desc": "Cafe.", "coords": [617, 420], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 109, "name": "Bombay Muchary", "category": "Food", "desc": "Eatery.", "coords": [607, 435], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 110, "name": "Honey", "category": "Food", "desc": "Food joint.", "coords": [600, 440], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 111, "name": "Wrap Chip", "category": "Food", "desc": "Food joint.", "coords": [594, 445], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 112, "name": "Sips n Bites", "category": "Food", "desc": "Food joint.", "coords": [587, 449], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 113, "name": "Pizza Nation", "category": "Food", "desc": "Food joint.", "coords": [581, 452], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 114, "name": "ATM", "category": "Misc", "desc": "ATM.", "coords": [585, 460], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 115, "name": "Iqbal Juice Corner", "category": "Food", "desc": "Juice stand.", "coords": [571, 461], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 116, "name": "Crave Clicks", "category": "Food", "desc": "Food joint.", "coords": [563, 467], "rating": 5.0, "image_url": "https://via.placeholder.com/400" },
  { "id": 117, "name": "Dessert Club", "category": "Food", "desc": "Dessert shop.", "coords": [557, 473], "rating": 5.0, "image_url": "https://via.placeholder.com/400" }
]

def run_migration():
    print("🚀 Starting Map Seeding...")
    db = SessionLocal()
    
    # Wipe old data
    db.query(models.Location).delete()
    
    for loc in LOCATIONS:
        y, x = loc["coords"]
        if loc.get("id", 100) < 52:
            y = round(y * SCALE_Y, 2)
            x = round(x * SCALE_X, 2)

        new_loc = models.Location(
            name=loc.get("name", "Unknown"),
            description=loc.get("desc", "Add long description..."),
            image_url=loc.get("image_url", "https://via.placeholder.com/400"),
            coordinates=f"{y},{x}",
            category=[loc.get("category", "Misc")],
            avg_rating=loc.get("rating", 5.0)
        )
        db.add(new_loc)
        
    db.commit()
    db.close()
    print(f"🎉 Done! {len(LOCATIONS)} locations are perfectly scaled and saved in the DB.")

if __name__ == "__main__":
    run_migration()