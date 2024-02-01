// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/IDynamic.sol";
import "./NFT.sol";
import "./BatchNFTs.sol";
import "./DataRegistry.sol";
import "./interfaces/IFactory.sol";

contract Voucher is Ownable, IERC721Receiver {
  using SafeMath for uint256;

  uint8 private lock = 0;
  modifier noReentrance() {
    require(lock == 0, "Contract is locking");
    lock = 1;
    _;
    lock = 0;
  }

  // constants definition
  uint8 private constant LINEAR_VESTING_TYPE = 1;
  uint8 private constant STAGED_VESTING_TYPE = 2;

  uint8 private constant DAILY_LINEAR_VESTING_TYPE = 1;
  uint8 private constant WEEKLY_LINEAR_VESTING_TYPE = 2;
  uint8 private constant MONTHLY_LINEAR_VESTING_TYPE = 3;
  uint8 private constant QUARTERLY_LINEAR_VESTING_TYPE = 4;

  bytes private constant BALANCE_KEY = "BALANCE";
  bytes private constant SCHEDULE_KEY = "SCHEDULE";
  bytes private constant FEE_KEY = "FEE";

  uint8 private constant REDEEM_BATCH_SIZE = 10; // maximum number of schedules to be redeemed onetime

  uint8 private constant FEE_STATUS = 1;

  uint8 private constant UNVESTED_STATUS = 0;
  uint8 private constant VESTED_STATUS = 1;
  uint8 private constant VESTING_STATUS = 2; // this status is specific for linear vesting type

  uint256 constant public MAX_INT = type(uint256).max;

  mapping(address => address) private tokenNftMap;
  address[] private _tokens;
  address[] private _nfts;

  address private immutable _protocolFactoryAddress;
  address private immutable _dataRegistry;

  // data schemas  

  struct VestingSchedule {
    uint256 amount;
    uint8 vestingType; // linear: 1 | staged: 2
    uint8 linearType; // day: 1 | week: 2 | month: 3 | quarter: 4
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint8 isVested; // unvested: 0 | vested : 1 | vesting : 2
    uint256 remainingAmount;
  }

  struct VestingFee {
    uint8 isFee; // no-fee: 0 | fee : 1
    address feeTokenAddress;
    address receiverAddress;
    uint256 totalFee;
    uint256 remainingFee;
  }

  struct Vesting {
    uint256 balance;
    VestingSchedule[] schedules;
    VestingFee fee;
  }

  struct BatchVesting {
    Vesting vesting;
    uint256 quantity;
  }

  event VoucherCreated(
    address indexed account,
    address indexed currency,
    uint256 amount,
    address indexed nftCollection,
    uint256 tokenId
  );

  event VoucherRedeem(
    address indexed account,
    address indexed currency,
    uint256 claimedAmount,
    address indexed nftCollection,
    uint256 tokenId
  );

  constructor(address factoryAddress, address dataRegistry) Ownable() {
    require(factoryAddress != address(0), "Invalid ERC20 token address");
    require(dataRegistry != address(0), "Invalid Data registry address");

    _protocolFactoryAddress = factoryAddress;
    _dataRegistry = dataRegistry;
  }

  function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) public override returns (bytes4){
      return IERC721Receiver.onERC721Received.selector;
    }

  function updateVestingScheduleBeforeCreate(VestingSchedule[] memory schedules) internal pure returns (VestingSchedule[] memory) {
    for (uint i = 0; i < schedules.length; i++) {
      schedules[i].remainingAmount = schedules[i].amount;
    }
    return schedules;
  }

  function createVoucherCollection(address token, string calldata name, string calldata symbol, IFactory.CollectionSettings calldata settings) public noReentrance returns (bool) {
    address nft = IFactory(_protocolFactoryAddress).createCollection(name, symbol, settings, IFactory.CollectionKind.ERC721A);
    if(tokenNftMap[token] == address(0) ){
      tokenNftMap[token] = nft;
      _tokens.push(token);
      _nfts.push(nft);
    }
    return true;
  }

  function setX(address _token, address _nft) public {
    if(tokenNftMap[_token] == address(0) ){
      // Update the value at this address
      tokenNftMap[_token] = _nft;
      _tokens.push(_token);
      _nfts.push(_nft);
    }
  }

  function getAllTokensNfts() public view returns (address[] memory tokens, address[] memory nfts) {
    return (_tokens, _nfts);
  }

  function getNftAddressFromMap(address tokenAddress) internal view returns (address nftAddress) {
    if(tokenNftMap[tokenAddress] == address(0) ){
      revert("Not support tokenAddress ");
    }
    nftAddress = tokenNftMap[tokenAddress];
    return nftAddress;
  }

  function getTokenAddressFromNftAddress(address nftAddress) internal view returns (address tokenAddress) {
    bool check = false;
    for (uint i = 0; i < _nfts.length; i++) {
      if (_nfts[i] == nftAddress) {
        tokenAddress = _tokens[i];
        check = true;
      }
    }
    if (!check) {
      revert("Not support nftAddress ");
    }
  }

  function create(address tokenAddress, Vesting memory vesting) public noReentrance returns (uint256) {
    address nftAddress = getNftAddressFromMap(tokenAddress);
    require(isQualifiedCreator(tokenAddress, _msgSender(), vesting.balance), "Requester must approve sufficient amount to create voucher");

    // stake amount of token to own pool
    require(IERC20(tokenAddress).transferFrom(_msgSender(), address(this), vesting.balance), "Stake voucher balance failed");

    vesting.schedules = updateVestingScheduleBeforeCreate(vesting.schedules);

    // mint new voucher
    uint256 tokenId = BatchNFTs(nftAddress).nextTokenId();
    BatchNFTs(nftAddress).mintBatchTo(_msgSender(), 1);

    // write data voucher
    bytes32 balanceKey = keccak256(BALANCE_KEY);
    bytes memory balanceValue = abi.encode(vesting.balance);

    bytes32 scheduleKey = keccak256(SCHEDULE_KEY);
    bytes memory scheduleValue = abi.encode(vesting.schedules);

    bytes32 feeKey = keccak256(FEE_KEY);
    bytes memory feeValue = abi.encode(vesting.fee);

    require(IDynamic(_dataRegistry).write(address(this), nftAddress, tokenId, balanceKey, balanceValue), "Write BALANCE failed");
    require(IDynamic(_dataRegistry).write(address(this), nftAddress, tokenId, scheduleKey, scheduleValue), "Write SCHEDULE failed");
    require(IDynamic(_dataRegistry).write(address(this), nftAddress, tokenId, feeKey, feeValue), "Write FEE failed");

    // transfer voucher to requester
    // IERC721(nftAddress).transferFrom(address(this), _msgSender(), tokenId);

    emit VoucherCreated(_msgSender(), tokenAddress, vesting.balance, nftAddress, tokenId);

    return tokenId;
  }

  function createBatch(address tokenAddress, BatchVesting memory batch) public noReentrance returns (uint256) {
    address nftAddress = getNftAddressFromMap(tokenAddress);

    // require(batchs.length > 0, "Num must be greater than zero");

    uint256 balance = batch.vesting.balance * batch.quantity;

    require(balance > 0, "Total balance must be greater than zero");
    
    batch.vesting.schedules = updateVestingScheduleBeforeCreate(batch.vesting.schedules);

    require(isQualifiedCreator(tokenAddress, _msgSender(), balance), "Requester must approve sufficient amount to create voucher");

    // stake amount of token to own pool
    require(IERC20(tokenAddress).transferFrom(_msgSender(), address(this), balance), "Stake voucher balance failed");

    uint256 _nextTokenId = BatchNFTs(nftAddress).nextTokenId();

    BatchNFTs(nftAddress).mintBatchTo(_msgSender(), batch.quantity);

    bytes32 balanceKey = keccak256(BALANCE_KEY);
    bytes memory balanceValue = abi.encode(batch.vesting.balance);

    bytes32 scheduleKey = keccak256(SCHEDULE_KEY);
    bytes memory scheduleValue = abi.encode(batch.vesting.schedules);

    bytes32 feeKey = keccak256(FEE_KEY);
    bytes memory feeValue = abi.encode(batch.vesting.fee);

    require(IDynamic(_dataRegistry).writeBatch(address(this), nftAddress, _nextTokenId, batch.quantity, balanceKey, balanceValue), "Write BALANCE failed");
    require(IDynamic(_dataRegistry).writeBatch(address(this), nftAddress, _nextTokenId, batch.quantity, scheduleKey, scheduleValue), "Write SCHEDULE failed");
    require(IDynamic(_dataRegistry).writeBatch(address(this), nftAddress, _nextTokenId, batch.quantity, feeKey, feeValue), "Write FEE failed");

    return batch.quantity;

    // // emit VoucherCreated(_msgSender(), tokenAddress, vesting.balance, nftAddress, tokenId);
  }


  function isQualifiedCreator(address tokenAddress, address creator, uint256 amount) internal view returns (bool){
    if (IERC20(tokenAddress).allowance(creator, address(this)) < amount) return false;
    return true;
  }

  function redeem(address nftAddress, uint256 tokenId, uint256 _amount) public noReentrance returns (bool) {
    address tokenAddress = getTokenAddressFromNftAddress(nftAddress);
    require(isQualifiedRedeemer(_msgSender(), tokenId, nftAddress), "Redeemer must be true owner of voucher");

    require(_amount > 0, "Want amount must be greater than zero");

    (uint256 balance, VestingSchedule[] memory schedules) = getDataBalanceAndSchedule(nftAddress, tokenId);

    (uint256 claimableAmount, uint8 batchSize, VestingSchedule[] memory _schedules) = getClaimableAndSchedule(nftAddress, tokenId, block.timestamp, _amount);

    require(balance > 0, "Voucher balancer must be greater than zero");
    require(claimableAmount <= IERC20(tokenAddress).balanceOf(address(this)), "Balance of pool is insufficient for redeem");

    require(batchSize > 0, "Not any schedule is available for vesting");
    require(claimableAmount <= balance, "Claimable amount must be less than or equal remaining balance of voucher");

    // require(_amount <= claimableAmount, "Want amount must be less than or equal claimable amount of voucher");

    uint256 transferAmount = _amount > claimableAmount ? claimableAmount : _amount;

    VestingFee memory fee = getDataFee(nftAddress, tokenId);

    uint256 feeAmount = transferAmount * fee.remainingFee / balance;

    // update voucher data: balance, schedules
    require(DataRegistry(_dataRegistry).safeWrite(_msgSender(), nftAddress, tokenId, keccak256(BALANCE_KEY), abi.encode(balance - transferAmount)), "Update BALANCE voucher failed");

    require(DataRegistry(_dataRegistry).safeWrite(_msgSender(), nftAddress, tokenId, keccak256(SCHEDULE_KEY), abi.encode(_schedules)), "Update SCHEDULE voucher failed");

    if (feeAmount > 0 && fee.isFee == FEE_STATUS ) {
      require(IERC20(fee.feeTokenAddress).transferFrom(_msgSender(), address(fee.receiverAddress), feeAmount), "Transfer fee failed");
      fee.remainingFee -= feeAmount;
      require(DataRegistry(_dataRegistry).safeWrite(_msgSender(), nftAddress, tokenId, keccak256(FEE_KEY), abi.encode(fee)), "Update FEE voucher failed");
    }

    // transfer erc20 token
    require(IERC20(tokenAddress).transfer(_msgSender(), transferAmount), "Transfer ERC20 token claimable amount failed");

    // emit VoucherRedeem(_msgSender(), tokenAddress, transferAmount, nftAddress, tokenId);
    
    return true;
  }

  function isQualifiedRedeemer(address redeemer, uint256 tokenId, address nftAddress) internal view returns (bool) {
    if (IERC721(nftAddress).ownerOf(tokenId) != redeemer) return false;
    return true;
  }

  function getClaimableStagedVesting(VestingSchedule memory schedule, uint256 timestamp, uint256 _amount, uint8 batchSize, uint256 claimableAmount) internal pure returns (VestingSchedule memory, uint256, uint8, uint256) {
    if (timestamp >= schedule.startTimestamp) {
      claimableAmount += schedule.remainingAmount;
      if (_amount < schedule.remainingAmount) {
        schedule.isVested = VESTING_STATUS; // update vesting status
        schedule.remainingAmount -= _amount;
        _amount = 0;
      } else {
        schedule.isVested = VESTED_STATUS;
        _amount -= schedule.remainingAmount;
        schedule.remainingAmount = 0;
      }
      batchSize ++;
    }
    return (schedule, claimableAmount, batchSize, _amount);
  }

  function getClaimableLinearVesting(VestingSchedule memory schedule, uint256 timestamp, uint256 _amount, uint8 batchSize, uint256 claimableAmount) internal pure returns (VestingSchedule memory, uint256, uint8, uint256) {
    if (timestamp >= schedule.endTimestamp) {
      claimableAmount += schedule.remainingAmount;
      if (_amount < schedule.remainingAmount) {
        schedule.isVested = VESTING_STATUS; // update vesting status
        schedule.remainingAmount -= _amount;
        _amount = 0;
      } else {
        schedule.isVested = VESTED_STATUS; // update vesting status
        _amount -= schedule.remainingAmount;
        schedule.remainingAmount = 0;
      }
      batchSize ++;
    } else if (timestamp >= schedule.startTimestamp) {
      uint256 linearClaimableAmount = calculateLinearClaimableAmount(timestamp, schedule);
      // claimable amount can not exceed remaining amount
      linearClaimableAmount = (schedule.remainingAmount > linearClaimableAmount ? linearClaimableAmount : schedule.remainingAmount);
      claimableAmount += linearClaimableAmount;
      if (_amount < linearClaimableAmount) { 
        schedule.remainingAmount -= _amount;
        _amount = 0;
      } else {
        schedule.remainingAmount -= linearClaimableAmount;
        _amount -= linearClaimableAmount;
      }
      schedule.isVested = VESTING_STATUS; // update vesting status
      batchSize ++;
    }
    return (schedule, claimableAmount, batchSize, _amount);
  }

  function getClaimableAndSchedule(address nftAddress, uint256 tokenId, uint256 timestamp, uint256 _amount) private view returns (uint256 claimableAmount, uint8 batchSize, VestingSchedule[] memory) {
    (uint256 balance, VestingSchedule[] memory schedules) = getDataBalanceAndSchedule(nftAddress, tokenId);
    uint8 j;
    while (batchSize<REDEEM_BATCH_SIZE && j+1 <= schedules.length && _amount > 0) {
      if (schedules[j].isVested == VESTED_STATUS) {
        // schedule is already vested, thus ignore
      } else if (schedules[j].vestingType == STAGED_VESTING_TYPE) {
        (schedules[j], claimableAmount, batchSize, _amount) = getClaimableStagedVesting(schedules[j], timestamp, _amount, batchSize, claimableAmount);
      } else if (schedules[j].vestingType == LINEAR_VESTING_TYPE) {
        (schedules[j], claimableAmount, batchSize, _amount) = getClaimableLinearVesting(schedules[j], timestamp, _amount, batchSize, claimableAmount);        
      }
      j++;
    }

    return (claimableAmount, batchSize, schedules);
  }

  function calculateLinearClaimableAmount(uint256 timestamp, VestingSchedule memory linearSchedule) internal pure returns (uint256) {
    require(linearSchedule.vestingType == LINEAR_VESTING_TYPE, "The vesting type must be LINEAR");
    require(timestamp >= linearSchedule.startTimestamp && timestamp < linearSchedule.endTimestamp, "Calculating block timestamp must reside in start-end time range of schedule");

    uint256 dailyTimeLapse = 24 * 60 * 60; // in seconds
    uint256 weeklyTimeLapse = 7 * dailyTimeLapse;
    uint256 monthlyTimeLapse = 30 * dailyTimeLapse; // for simplicity we would take 30 days for a month
    uint256 quarterlyTimeLapse = 3 * monthlyTimeLapse;

    // TODO: seeking for a more effective algorithm
    uint256 timeLapse;
    if (linearSchedule.linearType == DAILY_LINEAR_VESTING_TYPE) {
      timeLapse = dailyTimeLapse;
    } else if (linearSchedule.linearType == WEEKLY_LINEAR_VESTING_TYPE) {
      timeLapse = weeklyTimeLapse;
    } else if (linearSchedule.linearType == MONTHLY_LINEAR_VESTING_TYPE) {
      timeLapse = monthlyTimeLapse;
    } else if (linearSchedule.linearType == QUARTERLY_LINEAR_VESTING_TYPE) {
      timeLapse = quarterlyTimeLapse;
    } else {
      revert("unsupported linear vesting type");
    }

    uint256 scheduleTimeRange = linearSchedule.endTimestamp - linearSchedule.startTimestamp;
    uint256 claimableAmountPerSecond = linearSchedule.amount / scheduleTimeRange;
    uint256 numberLeap = ((timestamp - linearSchedule.startTimestamp) / timeLapse);
    uint256 claimableAmount = numberLeap * timeLapse * claimableAmountPerSecond;

    return claimableAmount + linearSchedule.remainingAmount - linearSchedule.amount; // actual claimable amount must exclude already vested amount
  }

  function getVoucher(address nftAddress, uint256 tokenId) public view returns (uint256 totalAmount, uint256 claimable, VestingSchedule[] memory schedules, VestingFee memory fee) {
    uint256 _nextTokenId = BatchNFTs(nftAddress).nextTokenId();
    require(tokenId < _nextTokenId, "Voucher not exist");
    (uint256  balance, VestingSchedule[] memory oschedules) = getDataBalanceAndSchedule(nftAddress, tokenId);
    (uint256 claimableAmount, uint8 batchSize, VestingSchedule[] memory newSchedules) = getClaimableAndSchedule(nftAddress, tokenId, block.timestamp, MAX_INT);

    fee = getDataFee(nftAddress, tokenId);

    return (balance, claimableAmount, oschedules, fee);
  }

  function getDataBalanceAndSchedule(address nftAddress, uint256 tokenId) private view returns(uint256, VestingSchedule[] memory) {
    bytes32 balanceKey = keccak256(BALANCE_KEY);
    bytes memory balanceValue = DataRegistry(_dataRegistry).read(nftAddress, tokenId, balanceKey);
    uint256 balance;
    (balance) = abi.decode(balanceValue, (uint256));

    bytes32 scheduleKey = keccak256(SCHEDULE_KEY);
    bytes memory scheduleValue = DataRegistry(_dataRegistry).read(nftAddress, tokenId, scheduleKey);
    VestingSchedule[] memory schedules;
    (schedules) = abi.decode(scheduleValue, (VestingSchedule[]));

    return (balance, schedules);
  }

  function getDataFee(address nftAddress, uint256 tokenId) private view returns(VestingFee memory fee) {
    bytes32 feeKey = keccak256(FEE_KEY);
    bytes memory feeValue = DataRegistry(_dataRegistry).read(nftAddress, tokenId, feeKey);
    fee = abi.decode(feeValue, (VestingFee));

    return fee;
  }

}